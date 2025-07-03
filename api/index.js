const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// 환경변수는 Vercel 대시보드에서 입력해야 함
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

// 파일 업로드용 multer
const upload = multer({ storage: multer.memoryStorage() });

// 1. 상태 확인 API (테스트용)
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// 2. 사용자 운동 현황 조회 (예시)
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. 사진 업로드 및 인증 (예시)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { user_id } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('exercise-images')
      .upload(`${user_id}/${Date.now()}_${file.originalname}`, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (error) throw error;

    // 인증 로그 DB 저장(예시)
    await supabase.from('exercise_logs').insert([
      {
        user_id,
        date: new Date().toISOString().slice(0,10),
        image_url: data.path,
        thumb_url: data.path, // 실제로는 썸네일 별도 처리 권장
      }
    ]);
    res.json({ message: '인증 완료', image_url: data.path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = (req, res) => {
  app(req, res);
};

// 서버리스 함수 방식: module.exports = app
module.exports = app;
