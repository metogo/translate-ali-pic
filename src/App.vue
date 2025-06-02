<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'

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
        imagePath: image.path
      })

      if (response.data.success) {
        // 从返回的数据中正确提取finalImageUrl
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

// 在文件顶部添加导入语句
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const downloadAllImages = async () => {
  if (translatedImages.value.length === 0) {
    ElMessage.warning('没有可下载的翻译图片')
    return
  }

  try {
    const zip = new JSZip()
    const promises = translatedImages.value.map(async (image, index) => {
      const response = await axios.get(image.translated, { responseType: 'arraybuffer' })
      zip.file(`translated-${index + 1}.jpg`, response.data)
    })

    await Promise.all(promises)
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'translated-images.zip')

    ElMessage.success('翻译后的图片已打包下载')
  } catch (error) {
    ElMessage.error('下载过程出错：' + error.message)
  }
}
</script>

<template>
  <div class="app-container">
    <div class="hero-section">
      <h1 class="title">图片翻译助手</h1>
      <p class="subtitle">轻松翻译图片中的文字，让语言不再是障碍</p>
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
            <div class="image-label">原始图片</div>
          </div>
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
</template>

<style scoped>
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
