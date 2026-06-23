'use client';

import { ReactFlowProvider } from '@xyflow/react';
import dynamic from 'next/dynamic';

const CubexApp = dynamic(() => import('@/components/CubexApp'), {
  ssr: false,
});

export default function Home() {
  return (
    <ReactFlowProvider>
      <CubexApp />
    </ReactFlowProvider>
  );
}
