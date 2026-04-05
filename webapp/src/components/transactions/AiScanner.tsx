import React, { useState } from "react";
import { toast } from "sonner";
import { parseWithOllama } from "@/services/localAiParser";
import { useCategoriesQuery, useCreateTransactionMutation } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileImage, FileText, Loader2, Sparkles, Trash2, CheckCircle2, Calendar, Store, DollarSign, Tag, TrendingUp, TrendingDown, CornerDownRight } from "lucide-react";
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

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [parsedItems, setParsedItems] = useState<TransactionCreate[] | null>(null);

  const resetState = () => {
    setFile(null);
    setPreviewUrl(null);
    setParsedItems(null);
    setIsScanning(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
      setParsedItems(null);
    }
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
    if (!file) return;
    setIsScanning(true);
    try {
      const catList = categories.map(c => ({ id: c.id, name: c.name }));
      
      let result;
      if (file.type.startsWith("image/")) {
        const b64 = await convertToBase64(file);
        result = await parseWithOllama(catList, { base64Image: b64 });
      } else if (file.type === "application/pdf") {
        const textContent = await extractTextFromPdf(file);
        result = await parseWithOllama(catList, { textContent });
      } else {
        throw new Error("Unsupported file type");
      }
      
      const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
      const today = new Date().toISOString().split("T")[0];
      
      const validItems = result.map((item: any) => {
        let date = item.date;
        if (!date || !isValidDate(date)) {
          date = today;
        }

        return {
          date,
          amountCents: Math.abs(typeof item.amountCents === "number" ? item.amountCents : parseInt(item.amountCents || "0", 10)),
          merchant: item.merchant || "",
          categoryId: item.categoryId || categories[0]?.id || "",
          notes: item.notes || (file.type === "application/pdf" ? "Imported from PDF" : "Imported from image"),
        };
      });

      setParsedItems(validItems);
      toast.success(`Found ${validItems.length} transactions`);
    } catch (error) {
      console.error(error);
      toast.error("Scanning failed. Check Ollama settings.");
    } finally {
      setIsScanning(false);
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
            <Label htmlFor="document-upload">Upload Receipt or PDF Statement</Label>
            <Input 
              id="document-upload" 
              type="file" 
              accept="image/*,.pdf" 
              onChange={handleFileChange} 
              disabled={isScanning} 
            />
          </div>

          {previewUrl && (
            <div className="mt-4 rounded-xl border p-2 bg-muted/10">
              <img src={previewUrl} alt="Preview" className="max-h-[240px] w-auto mx-auto object-contain rounded-lg shadow-sm" />
            </div>
          )}

          {file && file.type === "application/pdf" && (
            <div className="mt-4 rounded-xl border p-8 bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-50" />
              <div className="text-sm font-medium">{file.name}</div>
            </div>
          )}

          <Button onClick={handleScan} disabled={!file || isScanning} className="w-full h-11 rounded-xl">
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Document...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Scan Document
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
          
          <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
            {parsedItems.map((item, index) => (
              <div key={index} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-soft-sm relative group">
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
                                  <TrendingUp className="h-3.5 w-3.5 text-income" />
                                ) : (
                                  <TrendingDown className="h-3.5 w-3.5 text-expense" />
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
              </div>
            ))}
          </div>

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
