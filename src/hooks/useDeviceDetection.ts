import { useState, useEffect } from 'react'

export default function useDeviceDetection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile']
      const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword))
      const isMobileWidth = window.innerWidth < 768
      
      setIsMobile(isMobileUA || isMobileWidth)
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  return { isMobile }
}
