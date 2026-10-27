use serde::{Deserialize, Serialize};
use std::{
  io::{BufRead, BufReader},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::mpsc,
  thread,
  time::{Duration, Instant},
};

const STARTUP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionStatus {
  pub port: u16,
  pub pairing_code: String,
}

#[derive(Default)]
pub struct CompanionLauncher {
  child: Option<Child>,
  status: Option<CompanionStatus>,
}

impl CompanionLauncher {
  pub fn start(&mut self) -> Result<CompanionStatus, String> {
    let executable = companion_executable().ok_or_else(|| {
      "Bundled plaid-companion executable was not found beside the Budgetzilla app".to_string()
    })?;
    self.start_with_executable(&executable)
  }

  fn start_with_executable(&mut self, executable: &Path) -> Result<CompanionStatus, String> {
    if let Some(status) = &self.status {
      if self.child.as_mut().is_some_and(|child| child.try_wait().ok().flatten().is_none()) {
        return Ok(status.clone());
      }
      self.child = None;
      self.status = None;
    }
    self.start_executable(&executable)
  }

  fn start_executable(&mut self, executable: &Path) -> Result<CompanionStatus, String> {
    let mut child = Command::new(executable)
      .args(["serve", "--ipc"])
      .stdin(Stdio::null())
      .stdout(Stdio::piped())
      // Companion diagnostics are kept out of the desktop log and UI.
      .stderr(Stdio::null())
      .spawn()
      .map_err(|error| format!("Could not start plaid-companion: {error}"))?;

    let stdout = child.stdout.take().ok_or_else(|| "Companion startup channel is unavailable".to_string())?;
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
      let mut line = String::new();
      let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
      let _ = sender.send(result);
    });

    let started_at = Instant::now();
    let output = loop {
      match receiver.recv_timeout(Duration::from_millis(50)) {
        Ok(Ok(line)) if !line.trim().is_empty() => break line,
        Ok(Ok(_)) => continue,
        Ok(Err(error)) => {
          let _ = child.kill();
          return Err(format!("Could not read companion startup details: {error}"));
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
          let _ = child.kill();
          return Err("Companion exited before reporting its loopback endpoint".into());
        }
        Err(mpsc::RecvTimeoutError::Timeout) if started_at.elapsed() >= STARTUP_TIMEOUT => {
          let _ = child.kill();
          return Err("Timed out waiting for companion startup details".into());
        }
        Err(mpsc::RecvTimeoutError::Timeout) => {
          if child.try_wait().ok().flatten().is_some() {
            return Err("Companion exited before reporting its loopback endpoint".into());
          }
        }
      }
    };

    let status: CompanionStatus = match serde_json::from_str::<CompanionStatus>(&output) {
      Ok(status) if status.port > 0 && !status.pairing_code.is_empty() => status,
      _ => {
        let _ = child.kill();
        return Err("Companion returned invalid startup details".into());
      }
    };
    self.child = Some(child);
    self.status = Some(status.clone());
    Ok(status)
  }

  pub fn stop(&mut self) {
    if let Some(mut child) = self.child.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
    self.status = None;
  }
}

impl Drop for CompanionLauncher {
  fn drop(&mut self) {
    self.stop();
  }
}

fn companion_executable() -> Option<PathBuf> {
  let executable_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
  #[cfg(target_os = "windows")]
  let suffix = ".exe";
  #[cfg(not(target_os = "windows"))]
  let suffix = "";

  let exact = executable_dir.join(format!("plaid-companion{suffix}"));
  if exact.is_file() {
    return Some(exact);
  }

  // Tauri's externalBin bundling appends the Rust target triple.
  std::fs::read_dir(executable_dir)
    .ok()?
    .filter_map(Result::ok)
    .map(|entry| entry.path())
    .find(|path| {
      path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("plaid-companion-") && name.ends_with(suffix))
    })
}

#[cfg(all(test, unix))]
mod tests {
  use super::*;
  use std::{fs, sync::atomic::{AtomicUsize, Ordering}};

  static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

  fn fake_companion(startup: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!(
      "budgetzilla-plaid-companion-test-{}-{}",
      std::process::id(),
      NEXT_ID.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&path, format!("#!/bin/sh\nprintf '%s\\n' '{}'\nwhile :; do sleep 1; done\n", startup)).unwrap();
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    path
  }

  #[test]
  fn desktop_starts_companion_once_and_reuses_running_companion() {
    let executable = fake_companion(r#"{"port":41731,"pairingCode":"one-time"}"#);
    let mut launcher = CompanionLauncher::default();
    let first = launcher.start_executable(&executable).unwrap();
    let first_pid = launcher.child.as_ref().unwrap().id();
    let second = launcher.start_with_executable(&executable).unwrap();
    assert_eq!(first, second);
    assert_eq!(launcher.child.as_ref().unwrap().id(), first_pid);
    launcher.stop();
    let _ = fs::remove_file(executable);
  }

  #[test]
  fn desktop_reports_port_and_pairing_code_without_logging_secrets() {
    let executable = fake_companion(r#"{"port":41732,"pairingCode":"private-code"}"#);
    let mut launcher = CompanionLauncher::default();
    let status = launcher.start_executable(&executable).unwrap();
    assert_eq!(status.port, 41732);
    assert_eq!(status.pairing_code, "private-code");
    launcher.stop();
    let _ = fs::remove_file(executable);
  }

  #[test]
  fn desktop_stops_owned_companion_on_exit() {
    let executable = fake_companion(r#"{"port":41733,"pairingCode":"shutdown"}"#);
    let mut launcher = CompanionLauncher::default();
    launcher.start_executable(&executable).unwrap();
    let pid = launcher.child.as_ref().unwrap().id();
    launcher.stop();
    assert!(launcher.child.is_none());
    assert!(launcher.status.is_none());
    assert!(pid > 0);
    let _ = fs::remove_file(executable);
  }
}
