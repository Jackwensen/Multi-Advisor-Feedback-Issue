import OpenAI from "openai";
import { getGistData } from "./githubConfig.js";

const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();

const openai = new OpenAI({
  apiKey: openAiApiKey || "missing-openai-api-key",
  dangerouslyAllowBrowser: true,
});

function ensureOpenAiKey() {
  if (!openAiApiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY. Add it to your local .env file.");
  }
}

async function getRubricBasedFeedback(
  userWriting,
  rubricItem,
  messageList = [],
  columnCount,
  taskDescription
) {
  ensureOpenAiKey();

  const rubricItemDeepClone = JSON.parse(JSON.stringify(rubricItem));
  rubricItemDeepClone.criteria = JSON.parse(JSON.stringify(rubricItem.criteria));

  rubricItemDeepClone.criteria.forEach((criterion) => {
    Object.values(criterion).forEach((score) => {
      if (score && Object.prototype.hasOwnProperty.call(score, "userClick")) {
        delete score.userClick;
      }
    });
  });

  if (messageList.length === 0) {
    messageList.push({
      role: "developer",
      content: `You are an expert writing evaluator. Evaluate the user writing against the criteria for ${rubricItemDeepClone.dimension}, and give detailed reasons for each score decision.`,
    });
  }

  messageList.push({
    role: "user",
    content: `<role, task>
You are evaluating <user writing> for the dimension "${rubricItemDeepClone.dimension}".
Evaluate the writing strictly against <Criteria>. Return only a JSON array matching the output format.
</role, task>

${taskDescription ? `<writing task description>\n${taskDescription}\n</writing task description>` : ""}

<user writing>
${userWriting}
</user writing>

<Criteria>
${JSON.stringify(rubricItemDeepClone.criteria, null, 2)}
</Criteria>

<instructions>
1. Understand the criteria and their ${scoreScale(columnCount)} score scale.
2. For each criterion, select exactly one score by setting its "checked" field to true.
3. Leave all non-selected scores with "checked": false.
4. For the selected score, write a concise why reason grounded in the writing.
5. For each non-selected score, write a concise why-not reason grounded in the writing.
6. Use an Overall-Supporting structure in every reason field.
7. Return only valid JSON.
</instructions>

<output format example>
[
  {
    "score_1": {
      "checked": true,
      "text": "score_1 evaluation criteria",
      "reason": "Overall judgement.\\n- Specific evidence from the writing."
    },
    "score_2": {
      "checked": false,
      "text": "score_2 evaluation criteria",
      "reason": "Overall judgement.\\n- Specific reason why the writing does not match this score."
    }
  }
]
</output format example>`,
  });

  const completion = await openai.chat.completions.create({
    messages: messageList,
    temperature: 0,
    model: "gpt-5.4",
  });

  const responseMsg = completion.choices[0].message;
  messageList.push(responseMsg);
  return responseMsg;
}

async function generateCounterfactualWriting(
  userWriting,
  rubric,
  dimension,
  targetScore
) {
  ensureOpenAiKey();

  const currentScore = Object.entries(rubric)
    .find(([_, value]) => value.checked === true)?.[0]
    ?.slice(-1);

  if (!currentScore) {
    throw new Error("Cannot generate a suggested revision before the current score is available.");
  }

  const messages = [
    {
      role: "developer",
      content: `<role, task>
You are a writing revision assistant. Produce the smallest revision that would move the writing from its current criteria score to a specified target score.
</role, task>`,
    },
    {
      role: "user",
      content: `<role, task>
Revise <user writing> to meet target score_${targetScore} for the "${dimension}" criteria.
The revision may improve or reduce the writing, but it must make the fewest changes necessary to satisfy the target score.
</role, task>

<user writing>
${userWriting}
</user writing>

<criteria, current score, target score and rationale>
${generateCounterfactualText(rubric, targetScore, dimension)}
</criteria, current score, target score and rationale>

<instructions>
1. Compare the current score_${currentScore} criteria with target score_${targetScore}.
2. Revise only what is necessary to meet the target score.
3. Prefer small edits to existing sentences over adding or removing whole sentences.
4. Preserve the original style and tone unless the criteria require a change.
5. For each modified sentence, explain what changed, why it changed, and how it satisfies the target criteria.
6. Return only valid JSON.
</instructions>

<output format>
{
  "revised_writing": "The revised user writing.",
  "reason": [
    {
      "sentence": "The changed sentence.",
      "reason": "A concise explanation tied to the target criteria."
    }
  ]
}
</output format>`,
    },
  ];

  const completion = await openai.chat.completions.create({
    messages,
    temperature: 0,
    model: "gpt-5.4",
    seed: Date.now(),
  });

  return completion.choices[0].message;
}

function generateCounterfactualText(rubric, score, dimension) {
  const currentScore = Object.entries(rubric).find(
    ([_, value]) => value.checked === true
  );
  const targetScore = Object.entries(rubric).find(([_, value]) => {
    return parseInt(_.slice(-1), 10) === score;
  });

  const currentScoreText = `score_${currentScore[0].slice(-1)}: ${
    currentScore[1].text
  }. Reason: ${currentScore[1].reason}`;
  const targetScoreText = `score_${score}: ${targetScore[1].text}. Reason: ${
    targetScore[1].reason
  }`;
  const dimensionText = `Dimension: ${dimension}`;

  const criteriaText = Object.entries(rubric)
    .map(([key, value]) => `${key}: ${value.text}`)
    .join("\n");

  const isImprove = score > currentScore[0].slice(-1);
  const directionText = isImprove ? "improve" : "reduce";

  return `<criteria>
${dimensionText}
${criteriaText}
</criteria>

<current score and rationale>
The current score is ${currentScoreText}
</current score and rationale>

<target score and rationale>
The target score is ${targetScoreText}
</target score and rationale>

<revision direction>
Revise the user writing to ${directionText} it from ${currentScore[0]} to score_${score}.
</revision direction>`;
}

function scoreScale(columnCount) {
  if (columnCount === 4) {
    return "from score_4 to score_1";
  }
  if (columnCount === 5) {
    return "from score_5 to score_1";
  }
  if (columnCount === 6) {
    return "from score_6 to score_1";
  }
  return `from score_${columnCount} to score_1`;
}

async function getRubric() {
  const gistId = "8e5525adad4276955dedf9f46fc84148";

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    return data.files;
  } catch (error) {
    console.error("Error fetching criteria Gist:", error);
    return [];
  }
}

async function getWritingList() {
  const gistId = "cd5cfe1c444fb635f15b005507a94002";

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    return Object.keys(data.files).map((fileName) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: fileName,
      content: data.files[fileName].content,
    }));
  } catch (error) {
    console.error("Error fetching writing Gist:", error);
    return [];
  }
}

export {
  getRubricBasedFeedback,
  generateCounterfactualWriting,
  getRubric,
  getWritingList,
};
