const QuestionBank = (() => {
  const PATHS = {
    part1: '../Resource/PART1%E9%A2%98%E5%BA%93/papaen_part1_current.json',
    part1Answers: '../Resource/PART1%E9%A2%98%E5%BA%93/part1_band7_sample_answers.md',
    part23: '../Resource/PART2%263%E9%A2%98%E5%BA%93/papaen_part23_current.json',
    part23Answers: '../Resource/PART2%263%E9%A2%98%E5%BA%93/part23_band7_sample_answers.json',
    part2Combo: '../Resource/PART2%E4%B8%B2%E9%A2%98%E9%A2%98%E5%BA%93/papaen_part2_combo_current.json',
    part2ComboAnswers: '../Resource/PART2%E4%B8%B2%E9%A2%98%E9%A2%98%E5%BA%93/part2_combo_band7_sample_answers.json'
  };

  const PART2_COMBO = 'Part 2串题';

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

  async function loadText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    return response.text();
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function answerKey(text) {
    return cleanText(text).toLowerCase();
  }

  function parsePart1MarkdownAnswers(markdown) {
    const out = new Map();
    const text = String(markdown || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const heading = /^###\s+Q\d+\.\s+(.+?)\s*$/gm;
    const matches = Array.from(text.matchAll(heading));
    matches.forEach((match, index) => {
      const question = cleanText(match[1]);
      const bodyStart = (match.index || 0) + match[0].length;
      const bodyEnd = matches[index + 1]?.index ?? text.indexOf('\n## ', bodyStart);
      const rawAnswer = text.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd).trim();
      const answer = cleanText(rawAnswer);
      if (question && answer) out.set(answerKey(question), answer);
    });
    return out;
  }

  function normalizeTopic(topic, partHint, answerByContent = new Map()) {
    const questions = (topic.questions || []).filter(q => q.is_show !== 0).map(q => ({
      id: String(q.id),
      index: q.index,
      part: q.part || partHint,
      content: cleanText(q.content),
      is_show: q.is_show,
      answer: answerByContent.get(answerKey(q.content)) || cleanText(q.answers?.[0]?.content)
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

  const ANSWER_FIT_STOPWORDS = new Set(
    ('the a an of to in on at for and or but is are was were be been being do does did done you your yours i my me mine ' +
      'we our ours they their theirs he she it its this that these those there here what when where which who whom whose ' +
      'why how think thing things people person often usually really very much many more most some any all with without ' +
      'about would could should shall will can may might must have has had having not no yes than then also just like get ' +
      'make made take took time way day good important because while still even other others such into from out over').split(/\s+/)
  );

  function keywordSet(text) {
    return new Set(
      cleanText(text)
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !ANSWER_FIT_STOPWORDS.has(word))
    );
  }

  function questionAnswerFit(question, answerWords) {
    const questionWords = keywordSet(question);
    if (!questionWords.size) return 0;
    let hits = 0;
    questionWords.forEach(word => { if (answerWords.has(word)) hits += 1; });
    return hits / questionWords.size;
  }

  function normalizeAnswers(data, includeParts) {
    const include = includeParts ? new Set(includeParts) : null;
    const out = new Map();
    (data?.topics || []).forEach(topic => {
      const siblings = topic.answers || [];
      siblings.forEach(item => {
        if (include && !include.has(Number(item.part))) return;
        // The generated sample-answer file sometimes attaches an answer body
        // that actually discusses a sibling question from the same topic. Only
        // keep an answer when no sibling question fits its body better.
        const answerWords = keywordSet(item.answer);
        const ownFit = questionAnswerFit(item.question, answerWords);
        const misassigned = siblings.some(other => other !== item && questionAnswerFit(other.question, answerWords) > ownFit);
        if (misassigned) return;
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

  function shownTopics(topics) {
    const shown = topics.filter(t => t.isShow && t.questions.length);
    return shown.length ? shown : topics.filter(t => t.questions.length);
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

  function isTopicNodePart(partName) {
    return partName === 'Part 1' || partName === 'Part 2&3' || partName === PART2_COMBO;
  }

  function nodesPerPeak(partName) {
    return partName === PART2_COMBO ? 4 : isTopicNodePart(partName) ? 7 : 3;
  }

  function makePeak(topics, partName, index) {
    const cards = topics.slice(0, nodesPerPeak(partName));
    const topicLabels = cards.map(t =>
      isTopicNodePart(partName) ? shortLabel(t.title, 18) : topicQuestionLabel(t, partName === 'Part 3' ? 3 : 2)
    );
    if (!isTopicNodePart(partName)) {
      while (topicLabels.length < 3) topicLabels.push('Practice card');
    }
    return {
      name: isTopicNodePart(partName) ? `Set ${index + 1}` : cards[0]?.tag || cards[0]?.title || `${partName} Set ${index + 1}`,
      topics: topicLabels,
      cards,
      boss: 'Examiner',
      done: 0
    };
  }

  function makeParts(part1Topics, part23Topics, comboTopics = []) {
    const p1 = shownTopics(part1Topics);
    const p23 = shownTopics(part23Topics);
    const combo = shownTopics(comboTopics);
    return [
      { name: 'Part 1', peaks: chunk(p1, 7).map((topics, i) => makePeak(topics, 'Part 1', i)) },
      { name: 'Part 2&3', peaks: chunk(p23, 7).map((topics, i) => makePeak(topics, 'Part 2&3', i)) },
      { name: PART2_COMBO, peaks: chunk(combo, 4).map((topics, i) => makePeak(topics, PART2_COMBO, i)) }
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
      const [part1Data, part1AnswerText, part23Data, comboData, answerData, comboAnswerData] = await Promise.all([
        loadJSON(PATHS.part1),
        loadText(PATHS.part1Answers).catch(() => ''),
        loadJSON(PATHS.part23),
        loadJSON(PATHS.part2Combo),
        loadJSON(PATHS.part23Answers).catch(() => ({ topics: [] })),
        loadJSON(PATHS.part2ComboAnswers).catch(() => ({ topics: [] }))
      ]);
      const answerMap = normalizeAnswers(answerData);
      const comboAnswerMap = normalizeAnswers(comboAnswerData, [4]);
      const part1AnswerMap = parsePart1MarkdownAnswers(part1AnswerText);
      const part1Topics = (part1Data.topics || []).map(t => normalizeTopic(t, 1, part1AnswerMap));
      const part23Topics = withAnswers((part23Data.topics || []).map(t => normalizeTopic(t, 2)), answerMap);
      const comboTopics = withAnswers((comboData.topics || []).map(t => normalizeTopic(t, 4)), comboAnswerMap);
      const parts = makeParts(part1Topics, part23Topics, comboTopics);
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
    const partNo = partName === 'Part 1' ? 1 : partName === 'Part 3' ? 3 : partName === PART2_COMBO ? 4 : 2;
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

  // No fabricated fallback: an invented boilerplate reads like a mismatched
  // answer on the card. Empty means the UI shows a "no sample yet" placeholder.
  function fallbackAnswer(question) {
    return question?.answer || '';
  }

  function partQuestionNo(partName) {
    if (partName === 'Part 1') return 1;
    if (partName === 'Part 3') return 3;
    if (partName === PART2_COMBO) return 4;
    return 2;
  }

  function toPracticeQuestions(topic, partName) {
    const partNo = partQuestionNo(partName);
    return (topic?.questions || [])
      .filter(q => q.is_show !== 0)
      .filter(q => partName === 'Part 2&3' ? q.part === 2 || q.part === 3 : q.part === partNo)
      .map(q => {
        if (q.part === 4) return { ...q, qtext: topic.title, bullets: [q.content], answer: fallbackAnswer(q, topic) };
        if (q.part === 2) {
          const cue = splitCueCard(q.content);
          return { ...q, qtext: cue.title || q.content, bullets: cue.bullets.length ? cue.bullets : [topic.title], answer: fallbackAnswer(q, topic) };
        }
        return { ...q, qtext: q.content, bullets: [topic.title], answer: fallbackAnswer(q, topic) };
      });
  }

  return { load, getQuestion, getExaminerScript, splitCueCard, fallbackAnswer, cueTitle, partQuestionNo, toPracticeQuestions, PART2_COMBO };
})();
