import { useState } from 'react'
import { Camera, X, Phone, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from 'A/components/ui/button'
import type { EstimateData } from '@/pages/EstimateFlow'

type Props = {
  data: EstimateData
  updateData: (updates: Partial<EstimateData>) => void
  onNext: () => void
  onBack: () => void
}

export default function PhotoUpload({ data, updateData, onNext, onBack }: Props) {
  const [photos, setPhotos] = useState<File[]>(data.photos)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          const maxDim = 1920
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim
              width = maxDim
            } else {
              width = (width / height) * maxDim
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }))
              } else {
                reject(new Error('Compression failed'))
              }
            },
            'image/jpeg',
            0.85
          )
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setUploading(true)
    setError('')
    setUploadProgress(0)

    try {
      const compressed: File[] = []
      for (let i = 0; i < files.length; i++) {
        compressed.push(await compressImage(files[i]))
        setUploadProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setPhotos(prev => [...prev, ...compressed])
    } catch (err) {
      console.error('Compression error:', err)
      setError('Failed to process images. Please try again.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      // Reset input so same files can be re-added if removed
      e.target.value = ''
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleNext = async () => {
    if (photos.length < 2) {
      setError('Please add at least 2 photos to continue')
      return
    }

    setUploading(true)
    setError('')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      photos.forEach(photo => {
        formData.append('photos', photo)
      })

      // Show uploading progress (indeterminate)
      setUploadProgress(30)

      const response = await fetch('/api/upload-photos', {
        method: 'POST',
        body: formData
      })

      setUploadProgress(80)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || errorData.details || `Upload failed: ${response.status}`)
      }

      const { photoUrls } = await response.json()
      setUploadProgress(100)

      updateData({ photos, photoUrls })
      onNext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to upload photos: ${errorMessage}`)
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCall = () => {
    window.location.href = 'tel:+18084577600'
  }

  const hasPressureWashing = data.services.includes('pressure')

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-sky-50 tropical-bg">
      <div className="palm-right"></div>
      <div className="palm-left"></div>
      <div className="palm-top-left"></div>
      <div className="monstera-right"></div>
      <div className="monstera-left"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-100 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-sky-700 hover:text-sky-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <img
            src="/logo.png"
            alt="Blue Pacific Window Cleaning"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-xl font-semibold text-sky-900">Blue Pacific Window Cleaning</h1>
            <p className="text-xs text-sky-700">Serving Oahu</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-sky-950 mb-8 text-center">Show Us Your Home</h2>

          {/* Instructions */}
          <div className="bg-white rounded-xl p-6 mb-8 border-2 border-sky-100 shadow-sm">
            <p className="text-sky-900 font-medium mb-4">To give you the most accurate window cleaning estimate, please include:</p>

            <div className="space-y-3 text-sky-800">
              <div className="flex gap-3">
                <span className="flex-shrink-0">🏡</span>
                <p><strong>One photo of each side of your home</strong><br />
                (front, back, left, and right if possible)</p>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0">📷</span>
                <p><strong>Try to stand back far enough</strong> so we can see the entire wall and all windows in one shot.</p>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0">🪟</span>
                <p><strong>If any windows can't be seen from outside,</strong><br />
                just add one interior photo of that specific window — that's totally fine.</p>
              </div>

              {hasPressureWashing && (
                <div className="flex gap-3 pt-3 border-t border-sky-200">
                  <span className="flex-shrink-0">💧</span>
                  <div>
                    <p className="font-medium mb-1">If you're also requesting pressure washing:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Include wide photos of the areas you'd like cleaned</li>
                      <li>Driveways, walkways, lanais, walls, or other exterior surfaces</li>
                      <li>Stand back far enough so the full area is visible</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-sky-200">
              <p className="text-sky-800 font-medium mb-2">✨ Helpful tips:</p>
              <ul className="text-sm text-sky-700 space-y-1">
                <li>• Take photos during the day if possible</li>
                <li>• Hold your phone straight (not tilted up or down)</li>
                <li>• Wide shots work better than close-ups</li>
              </ul>
            </div>

            <p className="text-sky-900 font-medium mt-4">👍 Don't worry about being perfect — just do your best.</p>
          </div>

          <p className="text-center text-sky-700 mb-4">Most customers upload about 4–8 photos 👍</p>

          {/* Upload Button */}
          <label className="block mb-6">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <div className="border-2 border-dashed border-sky-300 rounded-xl p-8 text-center cursor-pointer hover:border-sky-500 hover:bg-sky-50/50 transition-all">
              {uploading && uploadProgress < 30 ? (
                <>
                  <Loader2 className="w-12 h-12 text-sky-600 mx-auto mb-3 animate-spin" />
                  <p className="text-lg font-semibold text-sky-950 mb-1">Processing photos...</p>
                  {uploadProgress > 0 && (
                    <div className="mt-3 w-full bg-sky-100 rounded-full h-2">
                      <div
                        className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Camera className="w-12 h-12 text-sky-600 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-sky-950 mb-1">📷 Add Your Photos</p>
                  <p className="text-sm text-sky-700">At least 2 photos required</p>
                </>
              )}
            </div>
          </label>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-sky-950">{photos.length} {photos.length === 1 ? 'photo' : 'photos'} added</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-sky-100 border-2 border-sky-200 shadow-sm">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Upload progress bar when submitting */}
          {uploading && uploadProgress >= 30 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-sky-700 mb-1">
                <span>Uploading photos...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-sky-100 rounded-full h-2.5">
                <div
                  className="bg-sky-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Continue Button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700 text-white shadow-lg rounded-xl"
            onClick={handleNext}
            disabled={uploading}
          >
            {uploading && uploadProgress >= 30 ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Uploading Photos...
              </>
            ) : (
              'Continue to Your Info'
            )}
          </Button>
        </div>
      </main>

      {/* Footer Call Option */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-sky-100 py-4 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={handleCall}
            className="text-sky-700 hover:text-sky-900 font-medium inline-flex items-center gap-2 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call Us
          </button>
        </div>
      </footer>
    </div>
  )
}
