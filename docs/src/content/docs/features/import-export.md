---
title: Import & Export
description: Moving data in and out of Budgetzilla.
---

Budgetzilla supports various import and export formats for data portability.

## Export Options

### CSV Export

Export individual data types as CSV files:

- **Transactions** — All transaction data
- **Categories** — Your category definitions
- **Budgets** — Budgetzilla allocations

Go to **Settings > Export** and select the data type to export.

### Excel Export

Export all data as a single Excel workbook with multiple sheets:

1. Go to **Settings > Export**
2. Click **Export to Excel**
3. Download the `.xlsx` file

The workbook includes:
- Transactions sheet
- Categories sheet
- Budgets sheet
- Summary statistics

## Import Options

### Cashew Import

Budgetzilla supports importing from [Cashew](https://cashewapp.web.app/), a popular budgeting app:

1. Export your data from Cashew as CSV
2. Go to **Settings > Import**
3. Select **Cashew CSV**
4. Upload your file
5. Review the preview
6. Confirm import

### CSV Import

Import transactions from any CSV file:

1. Go to **Settings > Import**
2. Select **CSV**
3. Upload your file
4. Map columns to Budgetzilla fields
5. Preview the data
6. Confirm import

#### Expected CSV Format

```csv
date,description,amount,category
2024-01-15,Grocery Store,-45.67,Food & Dining
2024-01-16,Salary,3000.00,Salary
```

## Data Backup

### Manual Backup

Regularly export your data to maintain backups:

1. Export to Excel (includes everything)
2. Store the file safely (cloud storage, external drive)

### Automated Backup

Use [Google Drive sync](/features/google-drive-sync/) for automatic backups.

## Migration from Other Apps

If you're coming from another budgeting app:

1. Export data from your current app (usually CSV)
2. Use the CSV import with column mapping
3. Review and clean up categories
4. Verify transaction totals match
