// ========================================
// 마음이 🌿 - 심리 상담 챗봇 백엔드 서버
// OpenAI Chat Completions API 프록시
// ========================================

const express = require('express');
const path = require('path');

// .env 파일이 있으면 자동 로드 (Node 20.6+ 내장 기능, 별도 의존성 불필요)
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.join(__dirname, '.env'));
  }
} catch (_) {
  /* .env 파일이 없으면 무시 — 환경변수로 직접 넘겨도 됨 */
}

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI 설정 (키는 환경변수로만 읽음 — 코드/클라이언트에 절대 하드코딩 금지)
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// 심리 상담사 "마음이" 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 "마음이"라는 이름의 따뜻하고 공감적인 한국어 심리 상담 도우미입니다.

[역할과 태도]
- 항상 한국어로, 부드럽고 다정한 존댓말로 대화합니다.
- 사용자의 감정을 먼저 충분히 공감하고 인정한 뒤, 부드럽게 한 가지 정도의 질문을 건네 대화를 이어갑니다.
- 판단하거나 가르치려 하지 않고, 사용자가 스스로 마음을 들여다볼 수 있도록 돕습니다.
- 응답은 너무 길지 않게 (보통 2~4문장) 따뜻하게 작성합니다.

[중요한 한계]
- 당신은 전문적인 의료·심리 치료를 대체하지 않는 AI 도우미입니다. 진단이나 처방을 하지 않습니다.

[위기 대응 — 매우 중요]
- 사용자가 자해, 자살, 극단적 선택, "죽고 싶다", "사라지고 싶다" 등 위기 신호를 보이면:
  반드시 깊이 공감하면서, 혼자 견디지 않도록 따뜻하게 격려하고,
  전문기관 연락처를 자연스럽게 안내하세요:
  자살예방 상담전화 109, 정신건강 위기상담전화 1577-0199 (24시간 가능).
  사용자가 소중한 존재이며 도움받을 자격이 있음을 전하세요.`;

app.use(express.json());

// 정적 파일 서빙 (같은 폴더의 index.html 등)
app.use(express.static(path.join(__dirname)));

// ========================================
// POST /api/chat — OpenAI 프록시
// ========================================
app.post('/api/chat', async (req, res) => {
  try {
    // API 키 검증
    if (!OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message:
          'OpenAI API 키가 설정되지 않았습니다. 환경변수 OPENAI_API_KEY를 설정한 뒤 서버를 다시 실행해 주세요.',
      });
    }

    const { messages } = req.body;

    // 입력 검증
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages 배열이 필요합니다.',
      });
    }

    // 클라이언트 메시지를 OpenAI 포맷으로 정제 (role/content 만 허용)
    const cleanMessages = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content }));

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        success: false,
        message: '유효한 대화 메시지가 없습니다.',
      });
    }

    // 시스템 프롬프트를 맨 앞에 추가
    const payload = {
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleanMessages],
      temperature: 0.8,
      max_tokens: 500,
    };

    // OpenAI 호출 (Node 18+ 내장 fetch 사용)
    const openaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!openaiRes.ok) {
      let detail = '';
      try {
        const errBody = await openaiRes.json();
        detail = errBody?.error?.message || '';
      } catch (_) {
        /* 무시 */
      }
      console.error(`OpenAI API 오류 (${openaiRes.status}): ${detail}`);
      return res.status(502).json({
        success: false,
        message: 'AI 응답을 가져오는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
      });
    }

    const data = await openaiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({
        success: false,
        message: 'AI 응답이 비어 있어요. 잠시 후 다시 시도해 주세요.',
      });
    }

    return res.json({ success: true, data: { reply } });
  } catch (err) {
    console.error('서버 처리 중 오류:', err);
    return res.status(500).json({
      success: false,
      message: '서버에서 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
    });
  }
});

// ========================================
// 에러 핸들링 미들웨어
// ========================================
app.use((err, _req, res, _next) => {
  console.error('처리되지 않은 오류:', err);
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했어요.' });
});

// ========================================
// 서버 시작 (로컬) / Vercel 등에서는 app export
// ========================================
if (require.main === module) {
  if (!OPENAI_API_KEY) {
    console.warn(
      '\n⚠️  경고: 환경변수 OPENAI_API_KEY가 설정되지 않았습니다.\n' +
        '   AI 응답을 받으려면 다음과 같이 실행하세요:\n' +
        '   OPENAI_API_KEY=sk-... node server.js\n'
    );
  }
  app.listen(PORT, () => {
    console.log(`🌿 마음이 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  });
}

module.exports = app;
