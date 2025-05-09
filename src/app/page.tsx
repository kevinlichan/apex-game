'use client';

import PacmanGame from "@/components/PacmanGame";

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen p-4 sm:p-12 bg-gradient-to-b from-sky-50 to-sky-100">
      <PacmanGame />
    </main>
  );
}
