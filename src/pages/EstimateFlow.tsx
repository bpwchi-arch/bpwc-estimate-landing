import { useState } from 'react'
import WelcomeScreen from '@/components/WelcomeScreen'
import HowItWorks from '@/components/HowItWorks'
import ServiceType from '@/components/ServiceType'
import PhotoUpload from '@/components/PhotoUpload'
import BasicInfo from '@/components/BasicInfo'
import Confirmation from '@/components/Confirmation'

export type EstimateData = {
  services: string[]
  photos: File[]
  photoUrls: string[]
  phone: string
  name: string
  address: string
  email: string
  windowService: string
  notes: string
}

export default function EstimateFlow() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<EstimateData>({
    services: [],
    photos: [],
    photoUrls: [],
    phone: '',
    name: '',
    address: '',
    email: '',
    windowService: '',
    notes: ''
  })

  const updateData = (updates: Partial<EstimateData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => setStep(prev => prev + 1)
  const prevStep = () => setStep(prev => prev - 1)

  return (
    <>
      {step === 1 && <WelcomeScreen onNext={nextStep} />}
      {step === 2 && <HowItWorks onNext={nextStep} onBack={prevStep} />}
      {step === 3 && <ServiceType data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />}
      {step === 4 && <PhotoUpload data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />}
      {step === 5 && <BasicInfo data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />}
      {step === 6 && <Confirmation />}
    </>
  )
}
