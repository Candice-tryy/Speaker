import { load, getQuestion, splitCueCard, fallbackAnswer } from "@/lib/question-bank";
import type { Question, Topic } from "@/lib/types";
import CardPractice, { type CardData } from "./CardPractice";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function toPracticeQuestion(question: Question, topic: Topic) {
  if (question.part === 4) {
    return {
      id: question.id,
      part: question.part,
      content: question.content,
      qtext: topic.title,
      bullets: [question.content],
      answer: fallbackAnswer(question, topic),
    };
  }
  if (question.part === 2) {
    const cue = splitCueCard(question.content);
    return {
      id: question.id,
      part: question.part,
      content: question.content,
      qtext: cue.title || question.content,
      bullets: cue.bullets.length ? cue.bullets : [topic.title],
      answer: fallbackAnswer(question, topic),
    };
  }
  return {
    id: question.id,
    part: question.part,
    content: question.content,
    qtext: question.content,
    bullets: [topic.title],
    answer: fallbackAnswer(question, topic),
  };
}

export default async function PracticePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const part = first(sp.part) || "Part 2";
  const topicId = first(sp.topicId);
  const questionId = first(sp.questionId);
  const p = first(sp.p);
  const pk = first(sp.pk);
  const n = first(sp.n);

  const bank = await load();
  const item = getQuestion(bank, topicId, questionId, part);
  const topic = item?.topic;
  const question = item?.question;

  let qtext = question?.content || `Talk about this topic.`;
  let bullets: string[] = [];
  const partNo = part === "Part 1" ? 1 : part === "Part 3" ? 3 : part === "Part 2串题" ? 4 : 2;
  const topicQuestions =
    topic?.questions
      .filter((q) => q.is_show !== 0)
      .filter((q) => (part === "Part 2&3" ? q.part === 2 || q.part === 3 : q.part === partNo))
      .map((q) => toPracticeQuestion(q, topic)) || [];
  const currentIndex = Math.max(0, topicQuestions.findIndex((q) => q.id === question?.id));

  if (question?.part === 4) {
    qtext = topic?.title || question.content;
    bullets = [question.content];
  } else if (question?.part === 2) {
    const cue = splitCueCard(question.content);
    qtext = cue.title || question.content;
    bullets = cue.bullets.length ? cue.bullets : topic ? [topic.title] : [];
  } else {
    bullets = topic ? [topic.title] : [];
  }

  const card: CardData = {
    part,
    crumb: topic?.title || part,
    qtext,
    bullets,
    answer: fallbackAnswer(question, topic),
    topicId: topic?.id || "",
    questionId: question?.id || "",
    questions: topicQuestions,
    currentIndex,
    loaded: bank.loaded,
    p,
    pk,
    n,
  };

  return <CardPractice card={card} />;
}
