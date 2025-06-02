<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// 语言选择
const sourceLanguage = ref('zh')  // 默认中文
const targetLanguage = ref('en')    // 默认英语

// 源语言选项（仅支持中文和英文）
const sourceLanguageOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' }
]

// 目标语言选项
const targetLanguageOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'es', label: '西班牙语' },
  { value: 'it', label: '意大利语' },
  { value: 'de', label: '德语' },
  { value: 'ru', label: '俄语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'vi', label: '越南语' },
  { value: 'id', label: '印尼语' },
  { value: 'th', label: '泰语' },
  { value: 'ms', label: '马来语' }
]

const imageList = ref([])
const translatedImages = ref([])
const isTranslating = ref(false)

const handleFileUpload = async (event) => {
  const files = event.target.files
  const formData = new FormData()

  for (let file of files) {
    if (!file.type.startsWith('image/')) {
      ElMessage.error('请只上传图片文件')
      continue
    }
    formData.append('images', file)

    const reader = new FileReader()
    reader.onload = (e) => {
      imageList.value.push({
        original: e.target.result,
        name: file.name,
        translated: null,
        status: 'pending' // pending, translating, done, error
      })
    }
    reader.readAsDataURL(file)
  }

  try {
    const response = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.data.success) {
      const files = response.data.files
      imageList.value = imageList.value.map((img, index) => ({
        ...img,
        path: files[index].path
      }))
      ElMessage.success('图片上传成功')
    }
  } catch (error) {
    ElMessage.error('图片上传失败：' + error.message)
  }
}

// 修改翻译函数，添加语言参数
const startTranslation = async () => {
  if (imageList.value.length === 0) {
    ElMessage.warning('请先上传图片')
    return
  }

  isTranslating.value = true

  try {
    for (let image of imageList.value) {
      if (image.status === 'done') continue

      image.status = 'translating'
      const response = await axios.post('/api/translate', {
        imagePath: image.path,
        sourceLanguage: sourceLanguage.value,
        targetLanguage: targetLanguage.value
      })

      if (response.data.success) {
        image.translated = response.data.result.body.data.finalImageUrl
        image.status = 'done'
        translatedImages.value.push(image)
      } else {
        image.status = 'error'
        ElMessage.error(`翻译失败：${image.name}`)
      }
    }
    ElMessage.success('所有图片翻译完成')
  } catch (error) {
    ElMessage.error('翻译过程出错：' + error.message)
  } finally {
    isTranslating.value = false
  }
}

const downloadAllImages = async () => {
  if (translatedImages.value.length === 0) {
    ElMessage.warning('没有可下载的翻译结果')
    return
  }

  try {
    const zip = new JSZip()
    const promises = translatedImages.value.map(async (image, index) => {
      const response = await fetch(image.translated)
      const blob = await response.blob()
      const fileName = `translated_${index + 1}${getFileExtension(image.name)}`
      zip.file(fileName, blob)
    })

    await Promise.all(promises)
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'translated_images.zip')
    ElMessage.success('翻译结果下载成功')
  } catch (error) {
    ElMessage.error('下载失败：' + error.message)
  }
}

// 获取文件扩展名的辅助函数
const getFileExtension = (filename) => {
  const ext = filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 1)
  return ext ? `.${ext}` : ''
}

</script>

<template>
  <div class="app-container">
    <div class="hero-section">
      <h1 class="title">图片翻译助手</h1>
      <p class="subtitle">轻松翻译图片中的文字，让语言不再是障碍</p>
    </div>

    <!-- 语言选择组件 -->
    <div class="language-select" v-if="imageList.length > 0">
      <div class="select-group">
        <el-select v-model="sourceLanguage" class="language-selector" placeholder="选择源语言">
          <el-option
            v-for="lang in sourceLanguageOptions"
            :key="lang.value"
            :label="lang.label"
            :value="lang.value"
          />
        </el-select>
        <div class="arrow">→</div>
        <el-select v-model="targetLanguage" class="language-selector" placeholder="选择目标语言">
          <el-option
            v-for="lang in targetLanguageOptions"
            :key="lang.value"
            :label="lang.label"
            :value="lang.value"
          />
        </el-select>
      </div>
    </div>
    
    <div class="upload-zone">
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        @change="handleFileUpload"
        class="file-input"
        id="file-input"
      >
      <label for="file-input" class="upload-label">
        <i class="el-icon-upload"></i>
        <span>点击或拖拽图片到这里</span>
        <span class="upload-hint">支持多张图片上传</span>
      </label>
    </div>

    <div class="action-buttons" v-if="imageList.length > 0">
      <el-button 
        type="primary" 
        @click="startTranslation"
        :loading="isTranslating"
        round
        class="action-button"
      >
        {{ isTranslating ? '翻译中...' : '开始翻译' }}
      </el-button>
      <el-button 
        type="success" 
        @click="downloadAllImages"
        :disabled="translatedImages.length === 0"
        round
        class="action-button"
      >
        下载翻译结果
      </el-button>
    </div>

    <div class="gallery">
      <div v-for="(image, index) in imageList" :key="index" class="translation-card">
        <div class="card-content">
          <div class="image-wrapper original">
            <img :src="image.original" :alt="image.name">
            <div class="image-wrapper translated" v-if="image.translated">
              <img :src="image.translated" :alt="'translated-' + image.name">
              <div class="image-label">翻译结果</div>
            </div>
            <div class="status-badge" :class="image.status">
              {{ 
                image.status === 'pending' ? '等待翻译' :
                image.status === 'translating' ? '翻译中...' :
                image.status === 'done' ? '翻译完成' :
                image.status === 'error' ? '翻译失败' : ''
              }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 添加语言选择样式 */
.language-select {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.select-group {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.language-selector {
  width: 140px;
}

.arrow {
  color: #666;
  font-size: 20px;
}

.app-container {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 40px 20px;
}

.hero-section {
  text-align: center;
  margin-bottom: 40px;
}

.title {
  font-size: 2.5rem;
  color: #2c3e50;
  margin-bottom: 16px;
  font-weight: 600;
}

.subtitle {
  font-size: 1.2rem;
  color: #6c757d;
  max-width: 600px;
  margin: 0 auto;
}

.upload-zone {
  background: white;
  border: 2px dashed #dee2e6;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 600px;
  margin: 0 auto 40px;
  transition: all 0.3s ease;
}

.upload-zone:hover {
  border-color: #4CAF50;
  background: #f1f8e9;
}

.file-input {
  display: none;
}

.upload-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #6c757d;
}

.upload-hint {
  font-size: 0.9rem;
  color: #9e9e9e;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 40px;
}

.action-button {
  min-width: 140px;
  height: 44px;
  font-size: 1.1rem;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.translation-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.translation-card:hover {
  transform: translateY(-4px);
}

.card-content {
  padding: 16px;
  position: relative;
}

.image-wrapper {
  margin-bottom: 16px;
  position: relative;
}

.image-wrapper img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.image-label {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.status-badge {
  position: absolute;
  top: 24px;
  right: 24px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  color: white;
}

.status-badge.pending {
  background: #ffd54f;
}

.status-badge.translating {
  background: #2196f3;
}

.status-badge.done {
  background: #4caf50;
}

.status-badge.error {
  background: #f44336;
}

@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .upload-zone {
    padding: 20px;
  }

  .gallery {
    grid-template-columns: 1fr;
    padding: 10px;
  }
}
</style>

