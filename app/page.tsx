import type { Metadata } from "next";
import { KaroboliApp } from "@/components/KaroboliApp";

export const metadata: Metadata = {
  title: "Karoboli — Voice-native procurement for India",
  description:
    "Turn multilingual buyer requirements and code-mixed supplier offers into auditable procurement decisions.",
};

export default function Home() {
  return <KaroboliApp />;
}
