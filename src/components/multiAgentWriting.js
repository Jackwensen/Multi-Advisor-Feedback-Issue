import { date } from "quasar";
import OpenAI from "openai";
import { localAPI, chatCompletionsGood } from "boot/axios";
import { getGistData } from "./githubConfig.js";

const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();

const openai = new OpenAI({
  apiKey: openAiApiKey || "missing-openai-api-key",
  dangerouslyAllowBrowser: true,
});

/**
 * Basic feedback agent for Control 2: LLM Feedback without Rubric
 * Provides only holistic score and one-sentence comment
 * @param {string} userWriting - The user's writing content
 * @returns {Promise<{score: number, comment: string}>}
 */
async function getBasicFeedback(userWriting) {
  console.log("getBasicFeedback input:", userWriting);

  const systemPrompt = `<role, task>
You are an expert writing evaluator with extensive experience in assessing academic and professional writing, specifically for ESL (English as a Second Language) learners. Your task is to provide a comprehensive yet concise holistic assessment of the given writing by applying the ESL Composition Profile.
</role, task>

<evaluation methodology>
You should follow a systematic approach to evaluate the writing:
1. **Content Analysis**: First, analyze the writing to understand its purpose and substance.
2. **Evaluation using ESL Composition Profile**: Evaluate the writing against the five core dimensions of the ESL Composition Profile: Content, Organization, Vocabulary, Language Use, and Mechanics.
3. **Systematic Assessment**: Evaluate the writing against each dimension on a 4-point scale.
4. **Holistic Scoring**: Synthesize your dimensional assessments into a single holistic score.
5. **Synthesized Feedback**: Identify the greatest strength and the 1-2 most critical areas for improvement, then provide concise, actionable feedback.
</evaluation methodology>

<instructions>
You have to do the following 6 steps:
1. **Analyze the Writing**: Examine the writing to understand its main ideas, purpose, and overall message.

2. **Evaluate with ESL Composition Profile**: Instead of creating a rubric, you must evaluate the writing based on the five fixed dimensions of the ESL Composition Profile:
   - **Content**: The substance of the writing, the development of the topic, the relevance and clarity of ideas.
   - **Organization**: The logical structure, coherence, paragraphing, and use of transitions.
   - **Vocabulary**: The range, precision, and appropriateness of word choice.
   - **Language Use**: The effectiveness and correctness of sentence structure, grammar, and idiomatic expressions.
   - **Mechanics**: The accuracy of spelling, punctuation, and capitalization.

3. **Dimensional Assessment**: For each of the five dimensions, mentally evaluate the writing on a 4-point scale:
   - 4: Excellent/Exceeds expectations
   - 3: Good/Meets expectations
   - 2: Satisfactory/Partially meets expectations
   - 1: Needs improvement/Below expectations

4. **Holistic Integration**: Combine your dimensional scores into a single holistic score from 0-100, considering the relative importance of each dimension for this type of writing.

5. **Synthesize Feedback**: Based on your dimensional assessment, identify the single greatest strength and the one or two most critical areas for improvement. Synthesize this into a concise, actionable feedback paragraph (2-3 sentences). The feedback should first acknowledge the strength and then clearly state the areas needing improvement, referencing the relevant ESL Composition Profile dimensions (e.g., Content, Organization, etc.).

6. **Quality Assurance**: Ensure your score reflects the actual quality demonstrated and your feedback is encouraging yet honest.
</instructions>

<output format>
Return ONLY a JSON object in this exact format:
{
  "score": [whole number from 0-100],
  "comment": "[A concise paragraph of 2-3 sentences summarizing the writing's main strength and 1-2 key areas for improvement, referencing the ESL Composition Profile dimensions.]"
}
</output format>`;

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `<user writing>
${userWriting}
</user writing>

Please evaluate this writing following the systematic methodology described above.`,
    },
  ];

  try {
    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: messages,
      temperature: 0,
      model: "gpt-4.1",
    });

    const responseMsg = completion.choices[0].message;
    console.log("getBasicFeedback response:", responseMsg);

    // 解析JSON响应
    const feedbackData = JSON.parse(responseMsg.content);

    // 验证响应格式
    if (
      typeof feedbackData.score !== "number" ||
      typeof feedbackData.comment !== "string"
    ) {
      throw new Error("Invalid response format from LLM");
    }

    // 确保分数在有效范围内
    feedbackData.score = Math.max(
      0,
      Math.min(100, Math.round(feedbackData.score))
    );

    return feedbackData;
  } catch (error) {
    console.error("Error in getBasicFeedback:", error);
    // 返回默认反馈以防API调用失败
    return {
      score: 75,
      comment:
        "Your writing shows good potential with room for improvement in clarity and structure.",
    };
  }
}

/**
 * Writing feedback agent
 * Old version: Criteria-based feedback agent
 * @param {*} message
 * @returns
 */
async function getFeedback(message, systemPrompt) {
  console.log("getFeedback1", message);

  const msg = JSON.parse(JSON.stringify(message));
  msg.forEach((obj) => {
    if (obj.time) {
      delete obj.time;
    }
    if (typeof obj.content !== "string") {
      obj.content.forEach((item) => {
        if (item.accept) {
          delete item.accept;
        }
        if (item.time) {
          delete item.time;
        }
      });
      obj.content = JSON.stringify(obj.content, null, 2);
    }
  });

  console.log("getFeedback2", msg);
  const lastItem = msg.splice(-1);
  console.log("getFeedback3", msg, lastItem);

  let systemMsg = [];
  systemMsg.push({
    content:
      `<role, task and criteria>\n` +
      systemPrompt +
      `\n</role, task and criteria>
<instructions>
Give feedback based on the criteria \n
Give up to two feedbacks at the same time! \n
</instructions>

<output format>
You should just return a JSON object, stick to the following format, and don't include any other words in your response. \n
The output must be in the same case as the original text!!! \n
[
  {
    "original_content": <The original content of the text to be improved, and must be in the same case as the original text.>,
    "suggested_revision": <Suggest an improvement to the original content>,
    "explanation": <Give an explanation of how the suggestions would improve the given sentence>,
  },
  ...
]
</output format>
`,

    role: "system",
  });

  const dialog = systemMsg.concat(lastItem);

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: dialog,
    temperature: 0.4,
    model: "gpt-4o",
  });
  const responseMsg = completion.choices[0].message;

  // 使用bigmodel的chat模型:
  // const completion = await chatCompletionsGood(dialog)
  // const responseMsg = completion.data.choices[0].message;

  console.log("responseMsg", responseMsg);
  return JSON.parse(JSON.stringify(responseMsg));
}

/**
 * Rubric-based feedback agent
 * New version: Rubric-based feedback agent
 * @param {*} userWriting
 * @param {*} rubricItem
 * @returns
 */
async function getRubricBasedFeedback(
  userWriting,
  rubricItem,
  messageList,
  columnCount,
  taskDescription
) {
  console.log("getRubricBasedFeedback1", userWriting, rubricItem);

  const rubricItemDeepClone = JSON.parse(JSON.stringify(rubricItem));
  rubricItemDeepClone.criteria = JSON.parse(
    JSON.stringify(rubricItem.criteria)
  );

  console.log("getRubricBasedFeedback2", rubricItemDeepClone);

  // 添加删除 userClick 属性的处理
  rubricItemDeepClone.criteria.forEach((criterion) => {
    Object.values(criterion).forEach((score) => {
      if (score.hasOwnProperty("userClick")) {
        delete score.userClick;
      }
    });
  });

  // 如果消息列表为空，添加开发者信息
  if (messageList.length === 0) {
    messageList.push({
      role: "developer",
      content: `You are an expert in evaluating the content of the user writing based on the rubric I give you, which is ${rubricItemDeepClone.dimension}, and give a detailed reason for your evaluation.`,
    });
  }

  messageList.push({
    content: `<role, task>
  You are an expert in evaluating <user writing> in the dimension of ${
    rubricItemDeepClone.dimension
  }.
  You should evaluate the <user writing> strictly based on the <Criteria>, and give a detailed reason for your evaluation.
  Return a json object, refer to the <output format example>, and don't include any other words in your response.
</role, task>

${
  taskDescription
    ? `<writing task description>\n${taskDescription}\n</writing task description>`
    : ""
}

<user writing>
  ${userWriting}
</user writing>

<Criteria>
  ${JSON.stringify(rubricItemDeepClone.criteria, null, 2)}
</Criteria>

<instructions>
  You have to do the following 6 steps:
  1. You need understand the <Criteria>. Which has a score scale ${scoreScale(
    columnCount
  )}, under each score, there is a text field which indicates the requirements of getting the corresponding score. Typically, the higher the score, the better the user writing in this criteria. ${
      taskDescription
        ? `You should also understand the <writing task description>.`
        : ""
    }
  2. For each Criteria, your evaluation for the <user writing> should strictly follow the criteria, and for each of those evaluation criteria, rigorously match the <user writing> with the ${scoreScale(
    columnCount
  )} of the text attributes and select the score that best matches the criteria and set its 'checked' field to true. Only one score can be true in each object of the array.
  3. Adopt a moderate evaluation approach: prioritize fairness by recognizing strengths in the writing, avoid overly harsh penalties for minor errors, and focus on the overall alignment with the criteria.
  4. For the score marked with "checked": true, provide a detailed “why” explanation. Write this in its "reason" field, explaining why this score was selected over the others.
  5. For each score marked with "checked": false, provide a detailed “why not” explanation. Write this in its "reason" field, explaining why the score was not selected.
  6. Use an Overall–Supporting structure in all "reason" fields. Should be a string(double quotes and markdown format with line breaks) of the overall evaluation of the score, followed by a bulleted list of specific reasons(1–2 sentences) and evidence that support the main point.
  7. Format your response as a single JSON object (see example below). Do not include any other text outside the JSON.
</instructions>

<output format example (In json format)>
[
  {
    "score_1": {
      "checked": true, // only one score can be true in each object of the array
      "text": score_1 evaluation criteria
      "reason": A string(double quotes and markdown format with line breaks) of the overall evaluation of the score, followed by a bulleted list of specific reasons(1–2 sentences) and evidence that support why the score was selected.
    },
    "score_2": {
      "checked": false,
      "text": score_2 evaluation criteria
      "reason": A string(double quotes and markdown format with line breaks) of the overall evaluation of the score, followed by a bulleted list of specific reasons(1–2 sentences) and evidence that support why the score was not selected.
    },
    "score_3": {
      "checked": false,
      "text": score_3 evaluation criteria
      "reason": A string(double quotes and markdown format with line breaks) of the overall evaluation of the score, followed by a bulleted list of specific reasons(1–2 sentences) and evidence that support why the score was not selected.
    },
    "score_4": {
      "checked": false,
      "text": score_4 evaluation criteria
      "reason": A string(double quotes and markdown format with line breaks) of the overall evaluation of the score, followed by a bulleted list of specific reasons(1–2 sentences) and evidence that support why the score was not selected.
    },
    ...
  }
]
</output format example>`,
    role: "user",
  });

  console.log(
    "rubric-based writing feedback message:\n",
    messageList[messageList.length - 1].content
  );

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: messageList,
    temperature: 0,
    model: "gpt-5.4",
    // seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  // 更新消息列表
  messageList.push(responseMsg);

  console.log("responseMsg", responseMsg);
  return responseMsg;
}

/**
 * Generate revised writing
 * @param {*} userWriting
 * @param {*} scoredCriteria
 * @returns
 */
async function generateRevisedWriting(userWriting, scoredCriteria) {
  let message = [
    {
      role: "developer",
      content: `<role, task>
You are a expert in revising user writing.
You should revise the writing based on the feedback of the writing.
</role, task>`,
    },
  ];

  const prompt = `<role, task>
You are a expert in revising <user writing>, based on the ${Array.from(
    { length: scoredCriteria.length },
    (_, i) => `<rubric and feedback ${i + 1}>`
  ).join(" ")}.
</role, task>

<user writing>
${userWriting}
</user writing>

${generateFeedbackText(scoredCriteria)}

<instructions>
1. Deeply understand the ${Array.from(
    { length: scoredCriteria.length },
    (_, i) => `<rubric and feedback ${i + 1}>`
  ).join(
    " "
  )}, which contains detailed rubrics, the score of the writing, and the reasoning of getting the score.
2. Revise the <user writing> strictly based on the ${
    scoredCriteria.length
  } detailed <rubric and feedback> in order to achieve the highest score of the ${
    scoredCriteria.length
  } rubrics. You should take all the ${
    scoredCriteria.length
  } rubrics into account, and revise the <user writing> based on the ${
    scoredCriteria.length
  } rubrics!
3. Revise the <user writing> strictly based on the ${
    scoredCriteria.length
  } rubrics, and directly return the revised writing in a json format, don't include any other words in your response.
</instructions>

<output format example>
{
"revised_writing": The revised <user writing>, which meets all the ${
    scoredCriteria.length
  } <rubric and feedback>.
}
</output format example>`;

  message.push({
    content: prompt,
    role: "user",
  });

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: message,
    temperature: 0.1,
    model: "gpt-4.1",
    seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  console.log("responseMsg", responseMsg);
  return responseMsg;
}

/**
 * Generate revised writing
 * @param {*} userWriting
 * @param {*} rubric
 * @returns
 */
async function generateCounterfactualWriting(
  userWriting,
  rubric,
  dimension,
  targetScore
) {
  const currentScore = Object.entries(rubric)
    .find(([_, value]) => value.checked === true)[0]
    .slice(-1);

  let message = [
    {
      role: "developer",
      content: `<role, task>
As an AI writing expert, you will revise a given text to meet a specific score on a rubric. Your goal is to function as a precise and logical revision tool.
</role, task>`,
    },
  ];

  const prompt = `<role, task>
As an AI writing expert, you will revise a given text, <user writing>, to meet a specific score on a rubric, <rubric>. Your goal is to function as a precise and logical revision tool.
I will give you the <user writing>, <rubric>, current score, and the target score, and you should revise the writing to achieve the target score of the rubric.
The revision can improve or reduce the user writing based on the rubric, but you should make the fewest changes possible to achieve the target score.
</role, task>

<Core Principle: Minimal Modification>
Your primary directive is to adhere to the principle of **minimal modification**.
You must make the fewest changes possible to achieve the target score. For each potential change, ask yourself: "Is this modification absolutely necessary to meet the criteria of the target score?" If the original text already meets a criterion, do not change it.
Your goal is not to write a perfect text, but to write a text that *precisely* meets the target score's requirements and nothing more.
</Core Principle: Minimal Modification>

<user writing>
${userWriting}
</user writing>

<rubric, current score, target score and rationale>
${generateCounterfactualText(rubric, targetScore, dimension)}
</rubric, current score, target score and rationale>

<instructions>
1. Analyze the Rubric: Thoroughly analyze the <rubric> to understand the criteria for each score level. Focus on the specific language that distinguishes the current score: score_${currentScore} from the target score: score_${targetScore}. Identify the key areas where the <user_writing> either fails to meet the target score criteria (if improving) or exceeds the current score criteria (if degrading).

2. Revise the Writing: Revise the <user_writing> to ${
    targetScore > currentScore ? "improve" : "degrade"
  } it, strictly adhering to the <rubric> and the **Core Principle of Minimal Modification**:
   - If improving, add or alter elements *only* to satisfy the higher score's criteria.
   - If degrading, remove or alter elements *only* to no longer meet the original score's criteria, aligning with the lower score.
   - Prioritize small adjustments to existing sentences (e.g., rephrasing, adjusting word choice, or rearranging content) over adding or removing entire sentences.
   - If adding or removing content is unavoidable, ensure it directly addresses the rubric’s criteria for the 'target_score' and remains minimal.
   - Preserve the original style and tone of the <user_writing> unless the rubric explicitly requires a change.

3. Provide Detailed Rationale: For each modified sentence, include a justification in the 'reason' array. Each justification object must contain:
   - 'sentence': The full, modified sentence as it appears in the 'revised_writing'.
   - 'reason': A detailed explanation that **explicitly ties the change to the rubric’s language**, all modifications to the sentence, including new words, phrases, and sentences, should be justified. Even minor modifications should be listed in the reason field, including:
     - **What** was changed (e.g., "added the phrase 'innovative approach'").
     - **Why** it was changed, quoting the exact phrase from the 'target_score' description in the <rubric> (e.g., "to meet the requirement of 'creative and engaging content' as stated in Score 4").
     - **How** the change satisfies that criterion.
     - The 'reason' field should be written in string format with line breaks, not as a list.

4. Format the Output: Return a single JSON object containing the 'revised_writing' and the 'reason' array. Do not include any text or explanations outside the JSON structure.
</instructions>

<output format example>
{
  "revised_writing": The revised <user writing>, which strictly meets the <rubric> of criteria ${dimension} and the target score ${targetScore}.
  "reason": [{
    "sentence": The changed sentence in the revised_writing which is different from the <user writing>, even if it is a minor change, you should list it in the reason field.
    "reason": A detailed reasoning behind each change to this sentence, which strictly referencing the ${targetScore} of the <rubric>. The 'reason' field should be written in string format with line breaks, not as a list.
    },{
    "sentence": The changed sentence in the revised_writing which is different from the <user writing>, even if it is a minor change, you should list it in the reason field.
    "reason": A detailed reasoning behind each change to this sentence, which strictly referencing the ${targetScore} of the <rubric>. The 'reason' field should be written in string format with line breaks, not as a list.
    },
    ...
  ]
}
</output format example>`;

  console.log("prompt", prompt);

  message.push({
    content: prompt,
    role: "user",
  });

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: message,
    temperature: 0,
    model: "gpt-5.4",
    seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  console.log("responseMsg", responseMsg);
  return responseMsg;
}

/**
 * Compute true diff group
 * @param {*} trueDiff
 * @returns {Array<{action: string, text: string}>}
 */
async function computeTrueDiffGroup(trueDiff, originalWriting, revisedWriting) {
  const diffGroup = [];
  trueDiff.forEach((item) => {
    diffGroup.push({
      action: item.added ? "added" : item.removed ? "removed" : "original",
      text: item.value,
    });
  });

  console.log("diffGroup", diffGroup);
  // 处理diffGroup生成二维数组
  const groupedDiffs = [];
  let tempGroup = [];
  let hasRemoved = false;

  for (let i = 0; i < diffGroup.length; i++) {
    const current = diffGroup[i];

    if (current.action === "removed") {
      // 如果之前已经有removed正在处理，先把之前的组放入结果
      if (hasRemoved && tempGroup.length > 0) {
        groupedDiffs.push(tempGroup);
      }

      tempGroup = [current];
      hasRemoved = true;
      // 寻找下一个added，同时收集中间的original
      let foundAdded = false;
      for (let j = i + 1; j < diffGroup.length; j++) {
        if (diffGroup[j].action === "removed") {
          // 遇到新的removed，结束当前查找
          i = j - 1; // 更新外层循环的索引，减1是因为外层循环还会加1
          foundAdded = true;
          break;
        } else if (diffGroup[j].action === "original") {
          tempGroup.push(diffGroup[j]);
        } else if (diffGroup[j].action === "added") {
          tempGroup.push(diffGroup[j]);
          i = j;
          foundAdded = true;
          hasRemoved = false;
          break;
        }
      }

      // 如果找到了added或遇到了新的removed，就把当前组放入结果
      if (foundAdded) {
        groupedDiffs.push(tempGroup);
        tempGroup = [];
      }
    } else if (current.action === "added" && !hasRemoved) {
      groupedDiffs.push([current]);
    } else if (current.action === "original" && !hasRemoved) {
      // 只有当不在removed和added之间时，才单独成组
      groupedDiffs.push([current]);
    }
  }

  // 处理最后可能剩余的组
  if (tempGroup.length > 0) {
    groupedDiffs.push(tempGroup);
  }

  return groupedDiffs;
}

//   let message = [{
//     "role": "developer",
//     "content":
// `<role, task>
// You are an expert system specialized in analyzing textual differences and organizing revisions. Your expertise includes:
// - Understanding semantic relationships between text modifications
// - Identifying cohesive revision units
// - Organizing complex text changes into logical groups
// - Maintaining precise textual fidelity

// Your task is to:
// 1. Analyze the provided discrepancy data between two versions of text
// 2. Group related modifications into independent revision units
// 3. Ensure each revision unit is:
//    - Semantically complete
//    - Mutually exclusive from other units
//    - Independently actionable (can be accepted or rejected as a whole)
//    - Preserving original text order and punctuation

// Critical requirements:
// - Maintain exact text order as in the original document
// - Preserve all punctuation marks without modification
// - Keep all whitespace and formatting intact
// - Do not trim or modify any text content
// - Ensure complete fidelity to the original text segments

// The discrepancy data will contain added, removed, and unchanged text segments that need to be organized into meaningful revision groups while maintaining strict textual accuracy.
// </role, task>`,
//   }];

//   const prompt = `
// <discrepancy data>
// ${JSON.stringify(diffGroup)}
// </discrepancy data>

// <instructions>
// 1. 任务目标：
//    将文本差异数据(<discrepancy data>)组织成一系列独立的修改单元，每个修改单元代表一个完整且有意义的修改。

// 2. 修改单元的定义：
//    - 基本组成：包含action（动作类型）和text（文本内容）
//    - action 类型：
//      * added: 在原文中新增的内容
//      * removed: 从原文中删除的内容
//      * original: 保持不变的内容

// 3. 修改单元的组织原则：
//    - 语义完整性：每个修改单元应该表达完整的语义修改
//    - 最小独立性：每个修改单元应该是最小的、不可再分的修改集合
//    - 互斥性：不同修改单元之间不应存在重叠或交叉

// 4. 修改单元的构成规则：
//    - 一个修改单元可能包含：
//      * 一对或多对removed和added操作
//      * 仅removed操作
//      * 仅added操作
//      * 相关的original操作
//    - original文本应根据语义关联归属到相应的修改单元

// 5. 用户交互设计：
//    - 每个修改单元可独立接受或拒绝
//    - 接受：执行该单元中的所有修改操作
//    - 拒绝：保留removed的文本，删除added的文本

// 6. 输出要求：
//    返回二维数组，其中：
//    - 外层数组：包含所有独立的修改单元
//    - 内层数组：每个修改单元包含的具体操作（added/removed/original）
//    - 确保修改单元间互斥，不重叠
//    - 确保text的顺序和内容与原文一致，不要trim或改变原文的顺序，不要忘记标点符号！

// 7. Critical requirements:
//   - Maintain exact text order as in the original document
//   - Preserve all punctuation marks without modification
//   - Keep all whitespace and formatting intact
//   - Do not trim or modify any text content
//   - Ensure complete fidelity to the original text segments

// The discrepancy data will contain added, removed, and unchanged text segments that need to be organized into meaningful revision groups while maintaining strict textual accuracy.
// </instructions>

// <output format example>
// [
//   [{
//       "action": "removed",
//       "text": "We present a novel"
//   },
//   {
//       "action": "added",
//       "text": "In this paper, we introduce an innovative"
//   },
//   {
//       "action": "original",
//       "text": " approach to compositional visual planning "
//   }],
//   [{
//     "action": "removed",
//     "text": "by"
//   },
//   {
//       "action": "added",
//       "text": "that captivates the reader with its dual strategy:"
//   },
//   {
//       "action": "original",
//       "text": " (1) fine-tuning large language models (LLMs) "
//   }],
// ...
// ]
// </output format example>`

//   message.push({
//     "content": prompt,
//     "role": "user",
//   });

//   console.log('prompt', prompt)

//   // 使用openai的chat模型:
//   const completion = await openai.chat.completions.create({
//     messages: message,
//     temperature: 0.1,
//     model: "gpt-4o",
//     seed: Date.now(),
//   });
//   const responseMsg = completion.choices[0].message;

// console.log('responseMsg', responseMsg);
// return responseMsg;

function generateFeedbackText(scoredCriteria) {
  return scoredCriteria
    .map((criteria, index) => {
      const feedbackNumber = index + 1;

      // 生成所有评分标准文本
      const rubricText = criteria.allScores
        .map((score) => ` ${score.level}: ${score.text}`)
        .join("\n");

      // 生成单个反馈文本
      return (
        `<rubric and feedback ${feedbackNumber}>\n` +
        `Rubric:\n` +
        `${rubricText}\n` +
        `The <user writing> got ${criteria.scoreKey}, reason is: ${criteria.scoreValue.reason}\n` +
        `</rubric and feedback${feedbackNumber}>`
      );
    })
    .join("\n\n");
}

function generateCounterfactualText(rubric, score, dimension) {
  // 获取当前选中的分数
  const currentScore = Object.entries(rubric).find(
    ([_, value]) => value.checked === true
  );
  const targetScore = Object.entries(rubric).find(([_, value]) => {
    console.log("value", value);
    console.log("_", _);
    return _ === "score_" + score;
  });
  console.log("currentScore", currentScore);
  console.log("targetScore", targetScore);
  const currentScoreText = `score_${currentScore[0].slice(-1)}: ${
    currentScore[1].text
  }`;

  const dimensionText = `Dimension: ${dimension}`;
  // 生成评分标准文本
  const rubricText = Object.entries(rubric)
    .map(([key, value]) => `score_${key.slice(-1)}: ${value.text}`)
    .reverse() // 反转数组使得分数从高到低排列
    .join("\n");

  // 告知是提升还是降低
  const isImprove = score > currentScore[0].slice(-1);
  const isImproveText = isImprove ? "improve" : "reduce";

  // 生成完整的反馈文本
  return `${dimensionText}\n${rubricText}\nThe <user writing> got score_${currentScore[0].slice(
    -1
  )} for this rubric, the reason is: ${
    currentScore[1].reason
  }. \nThe reason of not getting score_${score} is: ${targetScore[1].reason}`;
}

function scoreScale(columnCount) {
  let scale = "";
  for (let i = 1; i <= columnCount; i++) {
    scale += `score_${i}`;
    if (i < columnCount) {
      scale += ", ";
    }
  }
  return scale;
}

function formatDateTime(timestamp) {
  return date.formatDate(timestamp, "YYYY/MM/DD HH:mm:ss");
}

async function getAgents() {
  const gistId = "91bc083a4c4661903872a2528b701150";

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    const feedbackComments = Object.keys(data.files).map((fileName) => ({
      type: fileName,
      systemPrompts: data.files[fileName].content,
      messageList: [],
      checked: true,
    }));

    return feedbackComments;
  } catch (error) {
    console.error("Error fetching the Gist:", error);
    return []; // 发生错误时返回空数组
  }
}

// 获取评分标准 从 github gist 中获取
async function getRubric() {
  const gistId = "8e5525adad4276955dedf9f46fc84148"; // new
  // const gistId = 'a027f4db5db7c75fdfcb51bc5cf08e04'; // old

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    return data.files;
  } catch (error) {
    console.error("Error fetching the Gist:", error);
    return []; // 发生错误时返回空数组
  }
}

// 获取写作列表 从 github gist 中获取
async function getWritingList() {
  const gistId = "cd5cfe1c444fb635f15b005507a94002";

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    const writingList = Object.keys(data.files).map((fileName) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: fileName,
      content: data.files[fileName].content,
    }));

    return writingList;
  } catch (error) {
    console.error("Error fetching the Gist:", error);
    return []; // 发生错误时返回空数组
  }
}

/**
 * Generate revised writing based on user instruction
 * @param {string} userWriting - The original writing content
 * @param {string} userInstruction - User's modification instruction
 * @returns {Promise<Object>} Response with revised writing
 */
async function generateInstructionBasedWriting(userWriting, userInstruction) {
  let message = [
    {
      role: "developer",
      content: `<role, task>
You are an expert writing assistant that specializes in revising text according to specific user instructions.
Your task is to modify the given writing based on the user's instruction while maintaining the overall quality and coherence of the text.
</role, task>`,
    },
  ];

  const prompt = `<role, task>
You are an expert writing assistant. You will revise the <user writing> according to the specific <user instruction>.
Your goal is to make precise modifications that fulfill the user's request while preserving the overall quality and style of the writing.
</role, task>

<user writing>
${userWriting}
</user writing>

<user instruction>
${userInstruction}
</user instruction>

<instructions>
1. Carefully analyze the <user instruction> to understand exactly what modifications are requested.
2. Revise the <user writing> to fulfill the user's instruction while:
   - Maintaining the overall structure and flow of the text
   - Preserving the original writing style and tone unless specifically asked to change it
   - Maintaining the original meaning
   - Ensuring grammatical correctness and coherence
   - Making ONLY the necessary changes to address the user's request
3. Return the revised writing in the specified JSON format.
4. Leave the "reason" field as an empty array since detailed explanations are not required.
</instructions>

<output format>
{
  "revised_writing": "The revised version of the user writing that addresses the user instruction",
  "reason": []
}
</output format>`;

  message.push({
    content: prompt,
    role: "user",
  });

  try {
    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: message,
      temperature: 0.2,
      model: "gpt-4.1",
    });
    const responseMsg = completion.choices[0].message;

    console.log("generateInstructionBasedWriting response:", responseMsg);
    return responseMsg;
  } catch (error) {
    console.error("Error in generateInstructionBasedWriting:", error);
    // 返回错误响应
    return {
      content: JSON.stringify({
        revised_writing: userWriting,
        reason: [],
      }),
    };
  }
}

export {
  formatDateTime,
  getFeedback,
  getBasicFeedback,
  getRubricBasedFeedback,
  generateRevisedWriting,
  generateCounterfactualWriting,
  generateInstructionBasedWriting,
  computeTrueDiffGroup,
  getAgents,
  getRubric,
  getWritingList,
};
