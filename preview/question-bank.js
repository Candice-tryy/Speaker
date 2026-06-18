const QuestionBank = (() => {
  const PATHS = {
    part1: '../Resource/PART1%E9%A2%98%E5%BA%93/papaen_part1_archive.json',
    part23: '../Resource/PART2%263%E9%A2%98%E5%BA%93/papaen_part23_current.json',
    part23Answers: '../Resource/PART2%263%E9%A2%98%E5%BA%93/part23_band7_sample_answers.json'
  };

  const FALLBACK_TOPICS = [
    { id: 'fallback-p1', title: 'The area you live in', part: 1, questions: [
      { id: 'fallback-p1-q1', part: 1, content: 'What are some changes in the area recently?' },
      { id: 'fallback-p1-q2', part: 1, content: 'Are the people in your neighborhood nice and friendly?' },
      { id: 'fallback-p1-q3', part: 1, content: 'Do you like the area that you live in?' }
    ]},
    { id: 'fallback-p23', title: 'Childhood friend', part: 2, questions: [
      { id: 'fallback-p23-q1', part: 2, content: 'Describe a friend from your childhood You should say: Who he/she is Where you met each other What you often did together And explain what made you like him/her' },
      { id: 'fallback-p23-q2', part: 3, content: 'What do you think of online social media?' },
      { id: 'fallback-p23-q3', part: 3, content: 'Do you still keep in touch with your friends from childhood? Why or why not?' }
    ]}
  ];

  let cache;

  async function loadJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    const text = await response.text();
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeTopic(topic, partHint) {
    const questions = (topic.questions || []).map(q => ({
      id: String(q.id),
      index: q.index,
      part: q.part || partHint,
      content: cleanText(q.content),
      is_show: q.is_show
    })).filter(q => q.content);

    return {
      id: String(topic.id),
      index: topic.index,
      title: cleanText(topic.title),
      tag: cleanText(topic.tag_name),
      level: topic.level,
      isNew: topic.is_new === 1,
      isShow: topic.is_show !== 0,
      part: partHint,
      questions
    };
  }

  function normalizeAnswers(data) {
    const out = new Map();
    (data?.topics || []).forEach(topic => {
      (topic.answers || []).forEach(item => {
        out.set(String(item.question_id), cleanText(item.answer));
      });
    });
    return out;
  }

  function withAnswers(topics, answerMap) {
    return topics.map(topic => ({
      ...topic,
      questions: topic.questions.map(q => ({
        ...q,
        answer: answerMap.get(String(q.id)) || ''
      }))
    }));
  }

  function currentTopics(topics, max = 9) {
    const shown = topics.filter(t => t.isShow && t.questions.length);
    return (shown.length ? shown : topics).slice(0, max);
  }

  function chunk(items, size) {
    const groups = [];
    for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
    return groups;
  }

  function topicQuestionLabel(topic, part) {
    const question = topic.questions.find(q => q.part === part) || topic.questions[0];
    if (!question) return topic.title;
    if (part === 2) return shortLabel(cueTitle(question.content));
    return shortLabel(question.content);
  }

  function cueTitle(text) {
    return cleanText(text)
      .replace(/^Describe\s+/i, '')
      .replace(/\s+You should say:?.*$/i, '')
      .replace(/[.。]$/, '');
  }

  function shortLabel(text, max = 24) {
    const clean = cleanText(text);
    return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
  }

  function makePeak(topics, partName, index) {
    const cards = topics.slice(0, 3);
    const topicLabels = cards.map(t => partName === 'Part 1' ? shortLabel(t.title, 20) : topicQuestionLabel(t, partName === 'Part 3' ? 3 : 2));
    while (topicLabels.length < 3) topicLabels.push('Practice card');
    return {
      name: cards[0]?.tag || cards[0]?.title || `${partName} Set ${index + 1}`,
      topics: topicLabels,
      cards,
      boss: 'Examiner',
      done: 0
    };
  }

  function makeParts(part1Topics, part23Topics) {
    const p1 = currentTopics(part1Topics, 9);
    const p23 = currentTopics(part23Topics, 9);
    return [
      { name: 'Part 1', peaks: chunk(p1, 3).map((topics, i) => makePeak(topics, 'Part 1', i)) },
      { name: 'Part 2', peaks: chunk(p23, 3).map((topics, i) => makePeak(topics, 'Part 2', i)) },
      { name: 'Part 3', peaks: chunk(p23, 3).map((topics, i) => makePeak(topics, 'Part 3', i)) }
    ];
  }

  function indexBank(parts) {
    const topics = new Map();
    const questions = new Map();
    parts.forEach(part => part.peaks.forEach(peak => peak.cards.forEach(topic => {
      topics.set(String(topic.id), topic);
      topic.questions.forEach(question => questions.set(String(question.id), { topic, question }));
    })));
    return { topics, questions };
  }

  async function load() {
    if (cache) return cache;
    try {
      const [part1Data, part23Data, answerData] = await Promise.all([
        loadJSON(PATHS.part1),
        loadJSON(PATHS.part23),
        loadJSON(PATHS.part23Answers).catch(() => ({ topics: [] }))
      ]);
      const answerMap = normalizeAnswers(answerData);
      const part1Topics = (part1Data.topics || []).map(t => normalizeTopic(t, 1));
      const part23Topics = withAnswers((part23Data.topics || []).map(t => normalizeTopic(t, 2)), answerMap);
      const parts = makeParts(part1Topics, part23Topics);
      cache = { parts, ...indexBank(parts), loaded: true };
    } catch (error) {
      console.warn('Question bank fallback:', error);
      const parts = makeParts(
        [normalizeTopic(FALLBACK_TOPICS[0], 1)],
        [normalizeTopic(FALLBACK_TOPICS[1], 2)]
      );
      cache = { parts, ...indexBank(parts), loaded: false, error };
    }
    return cache;
  }

  function getQuestion(bank, topicId, questionId, partName) {
    if (questionId && bank.questions.has(String(questionId))) return bank.questions.get(String(questionId));
    const topic = topicId ? bank.topics.get(String(topicId)) : null;
    if (!topic) return null;
    const partNo = partName === 'Part 1' ? 1 : partName === 'Part 3' ? 3 : 2;
    const question = topic.questions.find(q => q.part === partNo) || topic.questions[0];
    return question ? { topic, question } : null;
  }

  function getExaminerScript(topic) {
    const part2 = topic?.questions?.find(q => q.part === 2);
    const part3 = topic?.questions?.filter(q => q.part === 3).slice(0, 3) || [];
    const script = [];
    if (part2) script.push({ q: part2.content, react: 'Thank you. I would like to ask a few follow-up questions.' });
    part3.forEach((question, index) => script.push({
      q: question.content,
      react: index === part3.length - 1 ? '' : ['Mm, I see.', 'That sounds reasonable.', 'Interesting.'][index % 3]
    }));
    return script.length ? script : [
      { q: `Let's talk about ${topic?.title || 'this topic'}. Could you give me your answer?`, react: 'Mm, I see.' },
      { q: 'Could you explain that in a little more detail?', react: '' }
    ];
  }

  function splitCueCard(text) {
    const clean = cleanText(text);
    const marker = clean.match(/\bYou should say:?\s*/i);
    if (!marker) return { title: clean, bullets: [] };
    const title = clean.slice(0, marker.index).trim();
    const rest = clean.slice(marker.index + marker[0].length).trim();
    const bullets = rest
      .split(/\s+(?=(?:Who|What|When|Where|Why|How|And explain)\b)/i)
      .map(item => item.trim())
      .filter(Boolean);
    return { title, bullets };
  }

  function fallbackAnswer(question, topic) {
    if (question?.answer) return question.answer;
    return `I would like to talk about ${topic?.title || 'this topic'}. In my opinion, the most important point is balance. I would answer it with a clear example, then explain one reason and one personal feeling, so the response sounds natural and complete.`;
  }

  return { load, getQuestion, getExaminerScript, splitCueCard, fallbackAnswer, cueTitle };
})();
