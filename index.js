require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

// 1. 모든 사용자 운동 현황 조회
app.get('/status', async (req, res) => {
  // 이번주(월~일) 기준 계산
  const today = new Date();
  const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
  const sunday = new Date(today.setDate(monday.getDate() + 6));
  const mondayStr = monday.toISOString().slice(0,10);
  const sundayStr = sunday.toISOString().slice(0,10);

  // 사용자별 이번주 카운트, 최근 사진, 경고 조회
  const { data: users } = await supabase.from('users').select('*');
  const result = [];

  for (const user of users) {
    // 이번주 인증 로그
    const { data: logs } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', mondayStr)
      .lte('date', sundayStr);

    // 최근 인증 로그
    const recent = logs && logs.length ? logs[logs.length - 1] : null;
    result.push({
      id: user.id,
      username: user.username,
      weekCount: logs.length,
      warningCount: user.warning_count,
      thumbUrl: recent ? recent.thumb_url : null,
      imageUrl: recent ? recent.image_url : null,
    });
  }

  res.json(result);
});

// 2. 사진 업로드 및 인증
app.post('/upload', upload.single('image'), async (req, res) => {
  const { user_id } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // 오늘 인증 여부 확인
  const today = new Date().toISOString().slice(0,10);
  const { data: todayLog } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('user_id', user_id)
    .eq('date', today);

  if (todayLog && todayLog.length > 0) {
    return res.status(400).json({ error: '오늘 이미 인증했습니다.' });
  }

  // 원본 업로드
  const { data, error } = await supabase.storage
    .from('exercise-images')
    .upload(`${user_id}/${Date.now()}_${file.originalname}`, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) return res.status(500).json({ error: error.message });

  // (실제 서비스는 썸네일 생성 필요, 여기선 원본만 저장)
  const image_url = data.path;
  const thumb_url = image_url; // 실제로는 썸네일 별도 생성

  // 인증 로그 저장
  await supabase.from('exercise_logs').insert([{
    user_id,
    date: today,
    image_url,
    thumb_url,
  }]);

  res.json({ message: '인증 완료', image_url });
});

app.listen(process.env.PORT, () => {
  console.log('Server running');
});
