import { useState } from 'react'
import { ArrowLeft, Phone, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EstimateData } from '@/pages/EstimateFlow'

type Props = {
  data: EstimateData
  updateData: (updates: Partial<EstimateData>) => void
  onNext: () => void
  onBack: () => void
}

export default function BasicInfo({ data, updateData, onNext, onBack }: Props) {