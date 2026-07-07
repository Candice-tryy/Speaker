import { load, getQuestion, splitCueCard, fallbackAnswer, toPracticeQuestions } from "@/lib/question-bank";
import CardPractice, { type CardData } from "./CardPractice";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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
  const topicQuestions = topic ? toPracticeQuestions(topic, part) : [];
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
