import React, { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { parseReceipt, getInferenceBackend } from "@/services/localAiParser";
import { ensureModelLoaded, isModelLoaded, type ModelStatus } from "@/services/webgpuInference";
import { useCategoriesQuery, useCreateTransactionMutation } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileImage, FileText, Loader2, Trash2, CheckCircle2, Calendar, Store, DollarSign, Tag, CornerDownRight, X } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { DownloadIcon } from "@/components/ui/download";
import { TrendingUpIcon } from "@/components/ui/trending-up";
import { TrendingDownIcon } from "@/components/ui/trending-down";
import type { TransactionCreate } from "@/types";
import { DateInput } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildCategoryTreeRows } from "@/lib/categoryHierarchy";
import { cn } from "@/lib/cn";
import * as pdfjsLib from "pdfjs-dist";

// Import the worker directly from pdfjs-dist using Vite's ?url suffix
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// Configure PDF.js worker to use the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
} as const;

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
} as const;

export function AiScanner({ onComplete }: { onComplete?: () => void }) {
  const categoriesQuery = useCategoriesQuery();
  const createTxn = useCreateTransactionMutation();
  
  const categories = categoriesQuery.data ?? [];
  const activeCategories = React.useMemo(() => categories.filter((c) => c.active), [categories]);
  const categoryRows = React.useMemo(() => buildCategoryTreeRows(activeCategories), [activeCategories]);

  const indentClass = React.useCallback((depth: number) => {
    if (depth <= 0) return undefined;
    const pl = ["pl-12", "pl-16", "pl-20", "pl-24", "pl-28"];
    return pl[depth - 1]!;
  }, []);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string; type: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [parsedItems, setParsedItems] = useState<TransactionCreate[] | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);

  const resetState = () => {
    previews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
    setFiles([]);
    setPreviews([]);
    setParsedItems(null);
    setIsScanning(false);
    setScanProgress({ current: 0, total: 0 });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
      
      const newPreviews = selectedFiles.map(file => ({
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        name: file.name,
        type: file.type
      }));
      setPreviews(prev => [...prev, ...newPreviews]);
      setParsedItems(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const toRemove = prev[index];
      if (toRemove?.url) URL.revokeObjectURL(toRemove.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const convertToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const extractTextFromPdf = async (f: File): Promise<string> => {
    const arrayBuffer = await f.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
      if (fullText.length > 8000) break;
    }
    return fullText;
  };

  const handleScan = async () => {
    if (files.length === 0) return;

    const backend = getInferenceBackend();

    if (backend === "webgpu" && !isModelLoaded()) {
      setModelStatus("downloading");
      try {
        await ensureModelLoaded((pct) => setDownloadProgress(pct));
        setModelStatus("ready");
      } catch (e) {
        console.error("Failed to load WebGPU model:", e);
        toast.error("Could not load AI model. Falling back to Ollama.");
        setModelStatus("error");
      }
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });

    const allExtractedItems: TransactionCreate[] = [];
    const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const today = new Date().toISOString().split("T")[0];
    const catList = categories.map((c) => ({ id: c.id, name: c.name }));

    try {
      for (let i = 0; i < files.length; i++) {
        setScanProgress((prev) => ({ ...prev, current: i + 1 }));
        const file = files[i];
        let result;

        if (file.type.startsWith("image/")) {
          const b64 = await convertToBase64(file);
          result = await parseReceipt(catList, {
            base64Image: b64,
            imageBlob: file,
          });
        } else if (file.type === "application/pdf") {
          const textContent = await extractTextFromPdf(file);
          result = await parseReceipt(catList, { textContent });
        } else {
          continue;
        }

        const validItems = result.map((item: any) => {
          let date = item.date;
          if (!date || !isValidDate(date)) date = today;

          return {
            date,
            amountCents: Math.abs(
              typeof item.amountCents === "number"
                ? item.amountCents
                : parseInt(item.amountCents || "0", 10),
            ),
            merchant: item.merchant || "",
            categoryId: item.categoryId || categories[0]?.id || "",
            notes:
              item.notes ||
              (file.type === "application/pdf"
                ? `From ${file.name}`
                : `From image ${file.name}`),
          };
        });

        allExtractedItems.push(...validItems);
      }

      setParsedItems(allExtractedItems);
      toast.success(
        `Scanning complete. Found ${allExtractedItems.length} transactions across ${files.length} files.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Scanning failed. Check your AI settings.");
    } finally {
      setIsScanning(false);
      setModelStatus(isModelLoaded() ? "ready" : "idle");
    }
  };

  const handleSaveAll = async () => {
    if (!parsedItems) return;
    let successCount = 0;

    for (const item of parsedItems) {
      const category = categories.find(c => c.id === item.categoryId);
      let finalAmountCents = Math.abs(item.amountCents);
      if (category && category.kind === "expense") finalAmountCents = -finalAmountCents;
      
      try {
        await createTxn.mutateAsync({ ...item, amountCents: finalAmountCents });
        successCount++;
      } catch (e) {
        console.error("Failed to insert item", e);
      }
    }
    
    if (successCount === parsedItems.length) {
      toast.success(`Saved all ${successCount} transactions`);
      resetState();
      onComplete?.();
    } else {
      toast.warning(`Saved ${successCount} out of ${parsedItems.length} transactions`);
    }
  };

  const updateParsedItem = (index: number, key: keyof TransactionCreate, value: any) => {
    if (!parsedItems) return;
    const newItems = [...parsedItems];
    let finalValue = value;
    if (key === "amountCents") finalValue = Math.abs(value);
    newItems[index] = { ...newItems[index], [key]: finalValue };
    setParsedItems(newItems);
  };

  const removeParsedItem = (index: number) => {
    if (!parsedItems) return;
    const newItems = parsedItems.filter((_, i) => i !== index);
    setParsedItems(newItems);
  };

  return (
    <div className="space-y-6 pt-2">
      {!parsedItems && (
        <div className="space-y-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="document-upload">Upload Receipts or PDF Statements (Multiple allowed)</Label>
            <Input 
              id="document-upload" 
              type="file" 
              accept="image/*,.pdf" 
              multiple
              onChange={handleFileChange} 
              disabled={isScanning} 
            />
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
              {previews.map((preview, idx) => (
                <div key={idx} className="relative group rounded-xl border border-border/60 overflow-hidden aspect-square bg-muted/10 flex flex-col items-center justify-center p-2 shadow-sm">
                  {preview.type.startsWith("image/") ? (
                    <img src={preview.url} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <FileText className="h-8 w-8 opacity-50" />
                      <div className="text-[10px] truncate max-w-full px-1">{preview.name}</div>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    disabled={isScanning}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur shadow-sm border flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleScan}
            disabled={files.length === 0 || isScanning || modelStatus === "downloading"}
            className="w-full h-11 rounded-xl shadow-soft-md"
          >
            {modelStatus === "downloading" ? (
              <>
                <DownloadIcon size={16} className="mr-2 animate-pulse" />
                Downloading AI model... {downloadProgress}%
              </>
            ) : isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {scanProgress.current} of {scanProgress.total}...
              </>
            ) : (
              <>
                <SparklesIcon size={16} className="mr-2" />
                Scan {files.length > 0 ? `${files.length} Document${files.length > 1 ? "s" : ""}` : "Documents"}
              </>
            )}
          </Button>
        </div>
      )}

      {parsedItems && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Found {parsedItems.length} transactions</div>
            <Button variant="ghost" size="sm" onClick={() => setParsedItems(null)}>Start Over</Button>
          </div>
          
          <motion.div
            className="space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {parsedItems.map((item, index) => (
              <motion.div key={index} variants={staggerItem} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-soft-sm relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -right-2 -top-2 h-8 w-8 rounded-full border bg-background shadow-soft-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeParsedItem(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Date
                    </Label>
                    <DateInput 
                      value={item.date} 
                      onChange={(val) => updateParsedItem(index, "date", val || "")} 
                      className="h-9 text-sm rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      Amount
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={item.amountCents / 100} 
                      onKeyDown={(e) => { if (e.key === "-") e.preventDefault(); }}
                      onChange={(e) => updateParsedItem(index, "amountCents", Math.round(parseFloat(e.target.value) * 100))} 
                      className="h-9 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    Category
                  </Label>
                  <Select
                    value={item.categoryId}
                    onValueChange={(v) => updateParsedItem(index, "categoryId", v)}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryRows.map((row) => {
                        const c = row.category;
                        const isChild = row.depth > 0;
                        const isParent = row.hasChildren;
                        return (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className={cn(indentClass(row.depth), isParent && "font-semibold")}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0 text-muted-foreground">
                                {c.kind === "income" ? (
                                  <TrendingUpIcon size={14} className="text-income" />
                                ) : (
                                  <TrendingDownIcon size={14} className="text-expense" />
                                )}
                              </span>
                              {isChild ? (
                                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                              ) : null}
                              <span className="min-w-0 flex-1 truncate text-xs">{c.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Store className="h-3.5 w-3.5" />
                    Merchant
                  </Label>
                  <Input 
                    placeholder="Merchant name"
                    value={item.merchant || ""} 
                    onChange={(e) => updateParsedItem(index, "merchant", e.target.value)} 
                    className="h-9 text-sm rounded-xl"
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="pt-2">
            <Button onClick={handleSaveAll} disabled={createTxn.isPending} className="w-full h-11 rounded-xl shadow-soft-lg">
              {createTxn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm & Save All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
