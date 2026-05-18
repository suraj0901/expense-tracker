/**
 * Export — client-side CSV and PDF generation.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { paiseToRupees } from '../domain/money';
import type { Paise } from '../domain/money';
import * as db from './client';

async function fetchExportData() {
  const transactions = await db.queryTransactions({ limit: 10000 });
  return transactions.map((t) => ({
    date: t.date,
    type: t.type,
    category: t.category,
    merchant: t.merchant ?? '',
    note: t.note ?? '',
    amount: paiseToRupees(t.amount as Paise),
  }));
}

export async function exportCSV(): Promise<void> {
  const rows = await fetchExportData();
  const headers = ['Date', 'Type', 'Category', 'Merchant', 'Note', 'Amount (INR)'];
  const csvLines = [headers.join(',')];
  for (const r of rows) {
    const escaped = [r.date, r.type, escapeCsvField(r.category), escapeCsvField(r.merchant), escapeCsvField(r.note), r.amount.toFixed(2)].join(',');
    csvLines.push(escaped);
  }
  const bom = '﻿';
  const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `expenses-${new Date().toISOString().split('T')[0]}.csv`);
}

export async function exportPDF(): Promise<void> {
  const rows = await fetchExportData();
  const doc = new jsPDF();
  const today = new Date().toISOString().split('T')[0];

  doc.setFontSize(16);
  doc.text('Expense Tracker — Export', 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${today}`, 14, 28);

  const totalExpense = rows
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = rows
    .filter((r) => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  doc.text(`Total Income: ₹${totalIncome.toLocaleString('en-IN')}  |  Total Expenses: ₹${totalExpense.toLocaleString('en-IN')}  |  Net: ₹${(totalIncome - totalExpense).toLocaleString('en-IN')}`, 14, 36);

  autoTable(doc, {
    startY: 42,
    head: [['Date', 'Type', 'Category', 'Merchant', 'Note', 'Amount (₹)']],
    body: rows.map((r) => [
      r.date,
      r.type,
      r.category,
      r.merchant,
      r.note,
      r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 255] },
  });

  doc.save(`expenses-${today}.pdf`);
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
