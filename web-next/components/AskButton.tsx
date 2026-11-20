"use client";
import WordShiftButton from "@/components/motion/WordShiftButton";
import { useContact } from "@/components/providers/ContactPanel";
export default function AskButton({ children = "문의하기" }: { children?: string }) {
  const { open } = useContact();
  return <WordShiftButton variant="solid" onClick={() => open()}>{children}</WordShiftButton>;
}
