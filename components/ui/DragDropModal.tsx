'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Stethoscope, FileText, Shield } from 'lucide-react'
import DragDropZone from './DragDropZone'
import FileList from './FileList'
import ResultDisplay from './ResultDisplay'
import { analyzeMedicalDocument, analyzeMedicalInsuranceDocs } from '@/lib/actions'

interface DragDropModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AnalysisResult {
  fileName: string
  analysis?: string
  error?: string
  success: boolean
}

type TabType = 'lab_reports' | 'discharge_summary' | 'insurance'

interface TabConfig {
  id: TabType
  name: string
  emoji: string
  description: string
  acceptConfig: {
    'image/*'?: string[]
    'application/pdf'?: string[]
    'application/msword'?: string[]
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'?: string[]
  }
}

const TAB_CONFIG: Record<TabType, TabConfig> = {
  lab_reports: {
    id: 'lab_reports',
    name: 'Lab Reports',
    emoji: '🩺',
    description:
      'Upload your blood tests, urine reports, imaging results, or any lab report to understand what each value means.',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  },
  discharge_summary: {
    id: 'discharge_summary',
    name: 'Doctor Notes',
    emoji: '📋',
    description:
      'Upload hospital discharge summaries, prescriptions, or doctor notes to understand your diagnosis and medications.',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
  },
  insurance: {
    id: 'insurance',
    name: 'Insurance',
    emoji: '🛡️',
    description:
      'Upload your insurance documents with medical reports to check if your treatment is covered.',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
  },
}

export default function DragDropModal({ isOpen, onClose }: DragDropModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lab_reports')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  const activeTabConfig = TAB_CONFIG[activeTab]

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles])
    setIsDragActive(false)
  }, [])

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append('files', file)
      })

      let response

      if (activeTab === 'insurance') {
        response = await analyzeMedicalInsuranceDocs(formData)
      } else {
        response = await analyzeMedicalDocument(formData)
      }

      if (response.success && response.data) {
        setAnalysisResults(response.data)
        setShowResults(true)
      } else {
        setAnalysisResults([
          {
            fileName: 'Error',
            error: response.error || 'Failed to analyze files',
            success: false,
          },
        ])
        setShowResults(true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setAnalysisResults([
        {
          fileName: 'Error',
          error: errorMessage,
          success: false,
        },
      ])
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setUploadedFiles([])
    setAnalysisResults([])
    setShowResults(false)
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    handleReset()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
              {/* Simple Header */}
              <div className="relative bg-gradient-to-r from-blue-50 to-white border-b border-gray-100 px-8 py-8 flex items-center justify-between">
                <div>
                  <p className="text-5xl mb-2">{activeTabConfig.emoji}</p>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {activeTabConfig.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Simple Tab Buttons */}
              {!showResults && (
                <div className="flex gap-2 px-8 pt-6 pb-0 overflow-x-auto">
                  {Object.values(TAB_CONFIG).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`px-4 py-2 rounded-full font-semibold transition-all text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab.emoji} {tab.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="px-8 pt-6 pb-8 max-h-[70vh] overflow-y-auto">
                {showResults ? (
                  // Results View
                  <div className="space-y-4">
                    <ResultDisplay results={analysisResults} />
                  </div>
                ) : (
                  // Upload View
                  <div className="space-y-6">
                    {/* Description */}
                    <p className="text-lg text-gray-700">
                      {activeTabConfig.description}
                    </p>

                    {/* Drag Drop Zone */}
                    <DragDropZone
                      onDrop={onDrop}
                      isDragActive={isDragActive}
                      acceptConfig={activeTabConfig.acceptConfig}
                    />

                    {/* File List */}
                    {uploadedFiles.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-3">
                          {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} selected
                        </p>
                        <FileList
                          files={uploadedFiles}
                          onRemoveFile={removeFile}
                          isLoading={isLoading}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Simple Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 flex items-center justify-between gap-3">
                <button
                  onClick={
                    showResults ? () => { handleReset(); onClose(); } : onClose
                  }
                  className="px-6 py-2.5 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isLoading}
                >
                  {showResults ? 'Done' : 'Cancel'}
                </button>

                {!showResults && (
                  <motion.button
                    onClick={handleAnalyze}
                    disabled={uploadedFiles.length === 0 || isLoading}
                    whileHover={uploadedFiles.length > 0 && !isLoading ? { scale: 1.05 } : {}}
                    whileTap={uploadedFiles.length > 0 && !isLoading ? { scale: 0.95 } : {}}
                    className={`px-8 py-2.5 font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      uploadedFiles.length === 0 || isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-4 h-4"
                        >
                          <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full" />
                        </motion.div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Analyze
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                )}

                {showResults && (
                  <motion.button
                    onClick={handleReset}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-2.5 font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    Try Another
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
