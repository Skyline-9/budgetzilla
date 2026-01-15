export type DriveStatus = {
    connected: boolean;
    mode: string;
    last_sync_at?: string | null;
    folder_id?: string | null;
    files: Array<{
        filename: string;
        file_id?: string | null;
        drive_md5?: string | null;
        drive_modified_time?: string | null;
        local_sha256?: string | null;
    }>;
};

export type DriveSyncResult = {
    filename: string;
    action: string;
    status: "ok" | "skipped" | "conflict" | "error";
    message?: string | null;
    conflict_local_copy?: string | null;
};

export type DriveSyncResponse = {
    mode: string;
    results: DriveSyncResult[];
    last_sync_at?: string | null;
};
