"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** ブラウザの印刷画面を開く（送信先で「PDF に保存」を選ぶと PDF になる） */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer /> PDFで保存
    </Button>
  );
}
