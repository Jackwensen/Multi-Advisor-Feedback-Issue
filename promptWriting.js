import OpenAI from "openai";

const openai = new OpenAI({
});

/**
 * Basic feedback agent for Text-LLM Feedback
 * Provides only holistic score and one-sentence comment
 * @param {string} userWriting - The user's writing content
 * @returns {Promise<{score: number, comment: string}>}
 */
async function getBasicFeedback(userWriting) {
  console.log('getBasicFeedback input:', userWriting);

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
      "role": "system",
      "content": systemPrompt
    },
    {
      "role": "user",
      "content": `<user writing>
${userWriting}
</user writing>

Please evaluate this writing following the systematic methodology described above.`
    }
  ];

  try {
    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: messages,
      temperature: 0,
      model: "gpt-4.1",
    });

    const responseMsg = completion.choices[0].message;
    console.log('getBasicFeedback response:', responseMsg);

    // 解析JSON响应
    const feedbackData = JSON.parse(responseMsg.content);

    // 验证响应格式
    if (typeof feedbackData.score !== 'number' || typeof feedbackData.comment !== 'string') {
      throw new Error('Invalid response format from LLM');
    }

    // 确保分数在有效范围内
    feedbackData.score = Math.max(0, Math.min(100, Math.round(feedbackData.score)));

    return feedbackData;

  } catch (error) {
    console.error('Error in getBasicFeedback:', error);
    // 返回默认反馈以防API调用失败
    return {
      score: 75,
      comment: "Your writing shows good potential with room for improvement in clarity and structure."
    };
  }
}

/**
 * Rubric-based feedback agent
 * New version: Rubric-based feedback agent
 * @param {*} userWriting
 * @param {*} rubricItem
 * @returns
 */
async function getRubricBasedFeedback(userWriting, rubricItem, messageList, columnCount, taskDescription) {
  console.log('getRubricBasedFeedback1', userWriting, rubricItem)

  const rubricItemDeepClone = JSON.parse(JSON.stringify(rubricItem));
  rubricItemDeepClone.criteria = JSON.parse(JSON.stringify(rubricItem.criteria));

  console.log('getRubricBasedFeedback2', rubricItemDeepClone)

  // 添加删除 userClick 属性的处理
  rubricItemDeepClone.criteria.forEach(criterion => {
    Object.values(criterion).forEach(score => {
      if (score.hasOwnProperty('userClick')) {
        delete score.userClick;
      }
    });
  });

  // 如果消息列表为空，添加开发者信息
  if (messageList.length === 0) {
    messageList.push({
      "role": "developer",
      "content": `You are an expert in evaluating the content of the user writing based on the rubric I give you, which is ${rubricItemDeepClone.dimension}, and give a detailed reason for your evaluation.`,
    });
  }

  messageList.push({
    "content":
`<role, task>
  You are an expert in evaluating <user writing> in the dimension of ${rubricItemDeepClone.dimension}.
  You should evaluate the <user writing> strictly based on the <Criteria>, and give a detailed reason for your evaluation.
  Return a json object, refer to the <output format example>, and don't include any other words in your response.
</role, task>

${taskDescription ? `<writing task description>\n${taskDescription}\n</writing task description>` : ''}

<user writing>
  ${userWriting}
</user writing>

<Criteria>
  ${JSON.stringify(rubricItemDeepClone.criteria, null, 2)}
</Criteria>

<instructions>
  You have to do the following 6 steps:
  1. You need understand the <Criteria>. Which has a score scale ${scoreScale(columnCount)}, under each score, there is a text field which indicates the requirements of getting the corresponding score. Typically, the higher the score, the better the user writing in this criteria. ${taskDescription ? `You should also understand the <writing task description>.` : ''}
  2. For each Criteria, your evaluation for the <user writing> should strictly follow the criteria, and for each of those evaluation criteria, rigorously match the <user writing> with the ${scoreScale(columnCount)} of the text attributes and select the score that best matches the criteria and set its 'checked' field to true. Only one score can be true in each object of the array.
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
    "role": "user",
  });

  console.log('rubric-based writing feedback message:\n', messageList[messageList.length - 1].content)

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: messageList,
    temperature: 0,
    model: "gpt-4.1",
    // seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  // 更新消息列表
  messageList.push(responseMsg);

  console.log('responseMsg', responseMsg);
  return responseMsg;
}

/**
 * Generate revised writing
 * @param {*} userWriting
 * @param {*} rubric
 * @returns
 */
async function generateCounterfactualWriting(userWriting, rubric, dimension, targetScore) {

  const currentScore = Object.entries(rubric).find(([_, value]) => value.checked === true)[0].slice(-1);

  let message = [{
    "role": "developer",
    "content":
`<role, task>
As an AI writing expert, you will revise a given text to meet a specific score on a rubric. Your goal is to function as a precise and logical revision tool.
</role, task>`,
  }];

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

2. Revise the Writing: Revise the <user_writing> to ${targetScore > currentScore ? 'improve' : 'degrade'} it, strictly adhering to the <rubric> and the **Core Principle of Minimal Modification**:
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
</output format example>`

  console.log('prompt', prompt)

  message.push({
    "content": prompt,
    "role": "user",
  });

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: message,
    temperature: 0,
    model: "gpt-4.1",
    seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  console.log('responseMsg', responseMsg);
  return responseMsg;

}
