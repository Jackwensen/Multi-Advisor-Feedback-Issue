import { date } from 'quasar'
import OpenAI from "openai";
import { getGistData, updateGistData } from './githubConfig.js';

const openAiApiKey = import.meta.env.VITE_OPENAI_API_KEY?.trim();

const openai = new OpenAI({
  apiKey: openAiApiKey || "missing-openai-api-key",
  dangerouslyAllowBrowser: true
});

async function getRubricBasicFeedback(rubricText, taskDescription) {
  console.log('getRubricBasicFeedback', rubricText, '\n\n', taskDescription);

  const systemPrompt = `<role, task>
You are an expert in rubric design and assessment with extensive experience in evaluating the quality of educational rubrics. Your task is to provide a comprehensive assessment of the given rubric based on established meta-rubric criteria and best practices in rubric design.
</role, task>

<evaluation methodology>
You should follow a systematic approach to evaluate the rubric quality:
1. **Content Analysis**: First, analyze the rubric structure, dimensions, and criteria descriptions.
2. **Evaluation using Meta-Rubric Standards**: Evaluate the rubric against three core quality dimensions of effective rubrics.
3. **Systematic Assessment**: Evaluate the rubric against each meta-dimension on a 4-point scale.
4. **Holistic Scoring**: Synthesize your dimensional assessments into a single holistic score.
5. **Synthesized Feedback**: Identify the greatest strength and the 1-2 most critical areas for improvement, then provide concise, actionable feedback.
</evaluation methodology>

<meta-rubric standards>
Evaluate the rubric based on these three core dimensions:

1. Criteria Alignment:
  - Score 4: All criteria measure essential learning outcomes. Each is defined so precisely that a single piece of evidence can only be scored under one criterion.
  - Score 3: Most criteria measure essential learning outcomes. Criteria are defined clearly enough that evidence largely fits under a single criterion, with minimal ambiguity.
  - Score 2: Some criteria measure essential learning outcomes. Definitions are general, causing evidence to frequently fit under multiple criteria.
  - Score 1: Few or no criteria measure essential learning outcomes. Definitions are vague, causing criteria to be redundant and overlapping.

2. Level Distinction:
  - Score 4: The scale creates a clear, logical progression of quality. All levels are defined with enough detail to be clearly distinguished from their neighbors.
  - Score 3: The scale shows a logical progression of quality. Most levels are clearly distinguished from their neighbors, though some may require minor interpretation.
  - Score 2: The progression of quality is sometimes illogical or unclear. It is difficult to distinguish between some adjacent levels.
  - Score 1: The progression is illogical or arbitrary. Levels are not distinct, making differentiation of performance impossible.

3. Descriptive Language:
  - Score 4: Language describes precise, specific, observable evidence. All descriptions for a criterion follow a parallel grammatical structure across levels.
  - Score 3: Language is mostly descriptive and objective, but may include some minor, un-defined subjective terms. Most descriptions follow a parallel structure.
  - Score 2: Language mixes descriptive and subjective/evaluative terms, providing limited observable evidence. Parallel structure is inconsistent.
  - Score 1: Language is primarily subjective and evaluative, offering no observable evidence. There is no parallel structure.
</meta-rubric standards>

<instructions>
You have to do the following 6 steps:
1. Analyze the Rubric Structure: Examine the rubric to understand its dimensions, scoring scale, criteria descriptions, and weighting.

2. Evaluate with Meta-Rubric Standards: Assess the rubric against each of the three meta-rubric dimensions listed above.

3. Dimensional Assessment: For each of the three meta-dimensions, mentally evaluate the rubric on a 4-point scale:
  - 4: Excellent/Exceeds standards
  - 3: Good/Meets standards
  - 2: Satisfactory/Partially meets standards
  - 1: Needs improvement/Below standards

4. Holistic Integration: Combine your dimensional scores into a single holistic score from 0-100, considering the relative importance of each meta-dimension for rubric effectiveness.

5. Synthesize Feedback: Based on your meta-dimensional assessment, identify the single greatest strength and the one or two most critical areas for improvement. Synthesize this into a concise, actionable feedback paragraph (2-3 sentences). The feedback should first acknowledge any strengths and then clearly state the areas needing improvement, referencing the relevant meta-rubric dimensions (e.g., Criteria & Alignment, Level Distinction, Descriptive Language).

6. Quality Assurance: Ensure your score reflects the actual rubric quality demonstrated and your feedback is constructive and specific.
</instructions>

<output format>
Return ONLY a JSON object in this exact format:
{
  "score": [whole number from 0-100],
  "comment": "[A concise paragraph of 2-3 sentences summarizing the rubric's main strength and 1-2 key areas for improvement, referencing the meta-rubric dimensions.]"
}
</output format>`;

  const messages = [
    {
      "role": "system",
      "content": systemPrompt
    },
    {
      "role": "user",
      "content": `<task description>
${taskDescription || 'No specific task description provided'}
</task description>

<rubric to evaluate>
${rubricText}
</rubric to evaluate>

Please evaluate this rubric following the systematic meta-rubric methodology described above.`
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
    console.log('getRubricBasicFeedback response:', responseMsg);

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
    console.error('Error in getRubricBasicFeedback:', error);
    // 返回默认反馈以防API调用失败
    return {
      score: 40,
      comment: "Your rubric shows basic structure but needs significant improvement in clarity and specificity of criteria to be effective for assessment."
    };
  }
}
/**
 * Writing feedback agent
 * @param {*} message
 * @returns
 */
async function getSubRubric(taskDescription, columnCount, criteriaDimension, criteriaDescription, criterion, score) {
  const systemPrompt = `You are a knowledgeable and professional writing tutor who is proficient in building rubrics for writing tasks.`
  let systemMsg = [];
  systemMsg.push({
    "content": systemPrompt,
    "role": "system"
  });

  const userPrompt = `
<role>
  You are a knowledgeable and professional writing tutor who is proficient in building rubrics for writing tasks.
</role>

<task>
  You are filling in a sub-rubric called ${criteriaDimension}, ${criteriaDescription} for a writing task ${taskDescription}.
  The rubric and its format is shown in <sub-rubric>. The scoring scale for this sub-rubric is from ${columnCount} to 1. And I already filled in the ${score} for this criterion.
  The higher the score, the better the writing.
  Please fill in the other scoring fields for this sub-rubric.
</task>

<sub-rubric>
  ${JSON.stringify(criterion, null, 2)}
</sub-rubric>

<instructions>
  First, you need to understand the criteria and the scoring scale ${score} which I already filled in.
  Then, you need to fill in the other scoring fields for this sub-rubric, using your professional knowledge on how to rate ${criteriaDimension} of the writing task, and the part of the sub-rubric I already filled in.
  Finally, you should return a JSON object as your response. The output format of the rubric should be the same as the format of <output format>.
</instructions>

<output format>
{
  "score_3": {
      "text": the requirements and criteria for getting this score,
      "checked": false
  },
  "score_2": {
      "text": the requirements and criteria for getting this score,
      "checked": false
  },
  "score_1": {
      "text": the requirements and criteria for getting this score,
      "checked": false
  }
}
</output format>`

  const dialog = systemMsg.concat({
    "content": userPrompt,
    "role": "user"
  });

  console.log('dialog', userPrompt);

    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: dialog,
      temperature: 0.4,
      model: "gpt-4.1",
    });
    const responseMsg = completion.choices[0].message.content;
    return responseMsg;

}

/**
 * Writing feedback agent
 * generate or refine an existing criterion for a rubric
 * @param {*} taskDescription
 * @param {*} columnCount
 * @param {*} dimension
 * @param {*} description
 * @param {*} criteria
 * @param {*} type 'Generate', 'Improve', 'Shorten', 'Elaborate', 'Bullet-point', 'Retry'
 * @returns
 */
async function getOrImproveCriterion(taskDescription, columnCount, dimension, description, criteria, type) {
  const systemPrompt = `You are a knowledgeable and professional writing tutor who is proficient in building and improving criteria for rubrics for writing tasks.`
  let systemMsg = [];
  systemMsg.push({
    "content": systemPrompt,
    "role": "system"
  });

  const userPrompt = `
<role>
  You are a knowledgeable and professional writing tutor who is proficient in building and improving criteria for rubrics for writing tasks.
</role>

<task>
  Given a criterion, shown in <criterion>, which may be incomplete, please ${type} this criterion across all score levels for the '${dimension}' dimension of a rubric for the writing task: '${taskDescription}'.
  The criterion has ${columnCount} score levels, and the score levels are from score_${columnCount} to score_1. Higher scores reflect stricter requirements and better performance.
  The rubric should be in the format of <output format>.
</task>

<criterion>
  ${JSON.stringify(criteria, null, 2)}
</criterion>

<instructions>
  Follow these steps to complete the task:
  [Step 1] Understand the rubric dimension '${dimension}' and the provided <criterion> content based on your professional knowledge. '${description ? `Dimension description: ${description}.` : ''}'
  [Step 2] ${type} the '${dimension}' criterion across all score levels from 'score_${columnCount}' to 'score_1', ensuring consistency and logical progression where higher scores indicate better writing quality. Higher scores reflect stricter requirements and better performance.
  [Step 3] Return only a JSON object with the updated criterion for all score levels, without any additional text or explanation. The output must match the <output format> and preserve the original text's case.

  Note: The operation '${type}' can be one of the following:
  - 'Generate': Create a new criterion from scratch.
  - 'Improve': Enhance clarity, detail, and overall quality.
  - 'Shorten': Make the descriptions more concise while retaining meaning.
  - 'Elaborate': Add more detail and depth to the descriptions.
  - 'Bullet-point': Format the descriptions as a single string with bullet points separated by line breaks (e.g., '• First point\\n• Second point').
  - 'Retry': Rewrite the criterion using a different approach.
</instructions>

<output format>
{
  "score_3": {
    "text": the ${type}-ed requirements and criteria for getting this score,
    "checked": false
  },
  "score_2": {
    "text": the ${type}-ed requirements and criteria for getting this score,
    "checked": false
  },
  "score_1": {
    "text": the ${type}-ed requirements and criteria for getting this score,
    "checked": false
  }
}
</output format>`

  console.log('dialog', userPrompt);

  const dialog = systemMsg.concat({
    "content": userPrompt,
    "role": "user"
  });

    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: dialog,
      temperature: 0.6,
      model: "gpt-4.1",
    });
    const responseMsg = completion.choices[0].message.content;
    return responseMsg;

}

/**
 * refine the description of a criterion
 * @param {*} taskDescription
 * @param {*} columnCount
 * @param {*} dimension
 * @param {*} description
 * @param {*} criterion
 * @param {*} score
 * @param {*} type 'Improve', 'Shorten', 'Elaborate', 'Bullet-point', 'Retry'
 * @returns
 */
async function refineDescription(taskDescription, columnCount, dimension, description, criterion, score, type) {
  const systemPrompt = `You are a knowledgeable and professional rubric writing tutor who is proficient in refining the description of a criterion for rubrics for writing tasks.`
  let systemMsg = [];
  systemMsg.push({
    "content": systemPrompt,
    "role": "system"
  });

  const userPrompt = `
<role>
  You are a knowledgeable and professional rubric writing tutor, you need to ${type} the description of a criterion for rubrics for writing tasks.
</role>

<task>
  You are tasked with ${type}ing the description of a criterion called ${dimension} ${description ? `, ${description},` : ''}which is a criterion of a rubric for a writing task, ${taskDescription}.
  The criterion of this rubric and its format is shown in <criterion>.
  The criterion has ${columnCount} score levels, and the score levels are from score_${columnCount} to score_1. Higher scores reflect stricter requirements and better performance.
  The description is in the text field of the corresponding ${score} object shown in <criterion>.
  The other scoring criteria can be either empty or filled in.
</task>

<criterion>
  ${JSON.stringify(criterion, null, 2)}
</criterion>

<instructions>
  Follow these steps to complete the task:
  [Step 1] Understand the rubric dimension '${dimension}' and the specific score level '${score}' that needs to be addressed.
  [Step 2] ${type} the description for the '${score}' level: '${criterion[`${score}`].text}'. If descriptions for other score levels are provided, ensure consistency and logical progression across the scale. If other levels are empty, use your expertise to ${type} the description for '${score}' accordingly.
  [Step 3] Return a JSON object containing only the updated description for the '${score}' level, maintaining the same format as shown in the <output format> section.

  Note: The operation '${type}' can be one of the following:
  - 'Improve': Enhance clarity, detail, and overall quality.
  - 'Shorten': Make the description more concise while retaining meaning.
  - 'Elaborate': Add more detail and depth to the description.
  - 'Bullet-point': Format the description as a string with bullet points separated by line breaks (e.g., '• First point\n• Second point').
  - 'Retry': Rewrite the description using a different approach.

  Important: The 'text' field must always be a single string, regardless of the operation type.
</instructions>

<output format>
{
  "${score}": {
      "text": the criterion description after ${type},
      "checked": false
  }
}
</output format>`

  console.log('dialog', userPrompt);
  const dialog = systemMsg.concat({
    "content": userPrompt,
    "role": "user"
  });

    // 使用openai的chat模型:
    const completion = await openai.chat.completions.create({
      messages: dialog,
      temperature: 0.4,
      model: "gpt-4.1",
    });
    const responseMsg = completion.choices[0].message.content;
    return responseMsg;

}

async function recommendCriterion(taskDescription, columnCount, tableData) {
  const systemPrompt = `You are a knowledgeable and professional rubric writing tutor who is proficient in making rubrics for writing tasks.`
  let systemMsg = [];
  systemMsg.push({
    "content": systemPrompt,
    "role": "system"
  });

  console.log('tableData', tableData);
  const existingDimensions = tableData.map(item => item.dimension).filter(item => item.trim().length > 0);
  console.log('existingDimensions', existingDimensions);

  const userPrompt = `
  <role>
    You are a knowledgeable and professional rubric writing tutor who is proficient in making criteria for rubrics for writing tasks.
  </role>

  <task>
    You are tasked with making a criterion for a rubric for a writing task: ${taskDescription}.
    The rubric should have ${columnCount} score levels, and the score levels are from score_${columnCount} to score_1. Higher scores reflect stricter requirements and better performance.
  </task>

  <instructions>
    Follow these steps to complete the task:
    [Step 1] Understand the writing task and the rubric format.${existingDimensions.length > 0 ? `\n\t[Step 1.1] The existing dimensions in the rubric are: ${existingDimensions.join(', ')}, the criterion you will make in the following step should be different from the existing dimensions.` : ''}
    [Step 2] Make a criterion for the rubric. You should give a criterion name and the description across score levels from score_${columnCount} to score_1.
    [Step 2.1] The criterion name should be a single word or short phrase that describes the criterion.
    [Step 2.2] The criterion description should be a single string that describes the criterion. The description should be concise and clear.
    [Step 3] Return a JSON object containing the criterion.
  </instructions>

  <output format>
    {
      "name": the name of the criterion,
      "criteria": {
        "score_3": {
          "text": the requirements and criteria for getting this score,
          "checked": false
        },
        "score_2": {
          "text": the requirements and criteria for getting this score,
          "checked": false
        },
        "score_1": {
          "text": the requirements and criteria for getting this score,
          "checked": false
        }
      }
    }
  </output format>
  `

  console.log('dialog', userPrompt);

  const dialog = systemMsg.concat({
    "content": userPrompt,
    "role": "user"
  });

  const completion = await openai.chat.completions.create({
    messages: dialog,
    temperature: 0.8,
    model: "gpt-4.1",
  });

  const responseMsg = completion.choices[0].message.content;
  return responseMsg;
}

async function elaborateDescription(taskDescription) {

  const systemPrompt = `You are a knowledgeable and professional rubric writing tutor who is proficient in elaborating the description of a writing task.`
  let systemMsg = [];
  systemMsg.push({
    "content": systemPrompt,
    "role": "system"
  });

  const userPrompt = `
<role>
  You are a professional rubric writing tutor, skilled in analyzing and concisely elaborating writing task descriptions for rubric creation.
</role>

<task>
  You are tasked with elaborating the writing task in ${taskDescription} into a concise, structured description with newline-separated bullet points, organized by thematic sections, while preserving the original intent.
</task>

<user input>
  ${taskDescription}
</user input>

<instructions>
  1. Analyze the Task:
     - Read the <user input> to identify the task type (e.g., essay, report), purpose (e.g., persuade, inform), and any missing details (e.g., audience, scope).
     - Make minimal, reasonable assumptions for missing details based on task context.

  2. Elaborate Concisely:
     - Expand the <user input> into a concise description, one sentence per section, including the following sections:
       - Task Objective: State the main goal in one sentence.
       - Topic (If the task is given a topic): List the main topic of the task in one sentence.
       - Context: Describe the task's setting or purpose in one sentence.
       - Requirements: Length Requirements (e.g., 100 words).
     - Keep each bullet point short, focused, and non-redundant (max 20 words per point).
     - Use newline characters (\n) to separate sections for readability.

  3. Return Output:
     - Return a JSON object with the elaborated description as a single string in the <output format> field.
     - Use clear section labels (e.g., "Task Objective: ... \n\n Topic: ... \n\n Context: ... \n\n Requirements: ...").
     - Exclude any text outside the JSON structure.

</instructions>

<output format>
{
  "task": give the elaborated description as a single string with line breaks.
}
</output format>
  `

  console.log('dialog', userPrompt);

  const dialog = systemMsg.concat({
    "content": userPrompt,
    "role": "user"
  });

  const completion = await openai.chat.completions.create({
    messages: dialog,
    temperature: 0.2,
    model: "gpt-4.1",
  });

  const responseMsg = completion.choices[0].message.content;
  return responseMsg;
}

/**
 * Rubric-based feedback agent
 * New version: Rubric-based feedback agent
 * @param {*} userRubric
 * @param {*} rubricItem
 * @returns
 */
async function getRubricBasedFeedback(userRubric, rubricItem, messageList, columnCount, taskDescription) {
  console.log('getRubricBasedFeedback1', userRubric, rubricItem)

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
      "content": `You are an expert in evaluating the content of the user rubric based on the meta-rubric I give you, which is ${rubricItemDeepClone.dimension}, and give a detailed reason for your evaluation.`,
    });
  }

  messageList.push({
    "content":
`<role, task>
  You are an expert in evaluating <user rubric> in the dimension of ${rubricItemDeepClone.dimension}.
  You should evaluate the <user rubric> strictly based on the <Evaluation Criteria>, and give a detailed reason for your evaluation.
  Return a json object, refer to the <output format example>, and don't include any other words in your response.
</role, task>

${taskDescription ? `<rubric task description>\n${taskDescription}\n</rubric task description>` : ''}

<user rubric>
  ${convertRubricToText(userRubric)}
</user rubric>

<Evaluation Criteria>
  ${convertCriteriaToText(rubricItemDeepClone.criteria)}
</Evaluation Criteria>

<instructions>
  You have to do the following 6 steps:
  1. You need understand the <Criteria>. Which has a score scale from score_${columnCount} to score_1, under each score, there is a text field which indicates the requirements of getting the corresponding score. Typically, the higher the score, the better the user rubric in this criteria. ${taskDescription ? `You should also understand the <rubric task description>.` : ''}
  2. For each Criteria, your evaluation for the <user rubric> should strictly follow the criteria, and for each of those evaluation criteria, rigorously match the <user rubric> with the score_${columnCount} to score_1 of the text attributes and select the score that best matches the criteria and set its 'checked' field to true. Only one score can be true in each object of the array.
  3. Adopt a moderate evaluation approach: prioritize fairness by recognizing strengths in the rubric, avoid overly harsh penalties for minor errors, and focus on the overall alignment with the criteria.
  4. For the score marked with "checked": true, provide a detailed "why" explanation with concrete examples. Write this in its "reason" field, explaining why this score was selected over the others.
  5. For each score marked with "checked": false, provide a detailed "why not" explanation with concrete examples. Write this in its "reason" field, explaining why the score was not selected and give examples of what the user rubric did not meet the criteria.
  6. Use an Overall–Supporting structure in all "reason" fields. Start with a concise overall evaluation of the score (1–2 sentences), followed by a bulleted list of specific reasons and concrete examples that support the main point. The "reason" field should be written in Markdown format with line breaks, not as a list.
  7. Format your response as a single JSON object (see example below). Do not include any other text outside the JSON.
</instructions>

<output format example (In json format)>
${JSON.stringify(addReasonToCriteria(rubricItemDeepClone.criteria), null, 2)}
</output format example>`,
    "role": "user",
  });

  console.log('rubric-based rubric feedback message:\n', messageList[messageList.length - 1].content)

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
 * @param {*} userRubric
 * @param {*} rubric
 * @returns
 */
async function generateCounterfactualRubric(userRubric, rubric, dimension, targetScore) {

  const currentScore = Object.entries(rubric).find(([_, value]) => value.checked === true)[0].slice(-1);

  let message = [{
    "role": "developer",
    "content":
`<role, task>
You are an expert rubric designer with extensive experience in developing high-quality assessment rubrics. Your task is to comprehensively revise the provided <user rubric> based on meta-rubric evaluation feedback to achieve a higher quality standard.
You will receive: (1) a user-created rubric, (2) meta-rubric evaluation results showing current performance and target performance, and (3) detailed rationale explaining gaps between current and target scores.
Your goal is to systematically improve the entire rubric structure to meet the target quality level.
</role, task>`,
  }];

  const prompt = `<role, task>
You are an expert rubric designer with extensive experience in developing high-quality assessment rubrics. Your task is to comprehensively revise the provided <user rubric> based on meta-rubric evaluation feedback to achieve a higher quality standard.
You will receive: (1) a user-created rubric, (2) meta-rubric evaluation results showing current performance and target performance, and (3) detailed rationale explaining gaps between current and target scores.
Your goal is to systematically improve the entire rubric structure to meet the target quality level.
</role, task>

<user rubric>
${JSON.stringify(userRubric, null, 2)}
</user rubric>

<meta-rubric evaluation feedback>
${generateCounterfactualText(rubric, targetScore, dimension)}
</meta-rubric evaluation feedback>

<revision principles>
1. Comprehensive Enhancement: Address all identified weaknesses across the entire rubric, not just individual score levels.
2. Systematic Improvement: Ensure all score levels within each criterion work together as a coherent progression.
3. Scalable Design: Adapt your revisions to work with any number of score levels (the rubric may have 3-6 score levels).
4. Quality Standards: Focus on achieving the target score by addressing the specific gaps identified in the <meta-rubric evaluation feedback>.
5. Consistency: Maintain consistent language, structure, and expectations across all dimensions and score levels.
</revision principles>

<instructions>
1. Analyze the <meta-rubric evaluation feedback>: Carefully examine the meta-rubric evaluation to understand:
   - What the current score represents and why it was assigned
   - What the target score requires and why it wasn't achieved
   - Specific areas needing improvement based on the detailed rationale

2. Identify Revision Areas: Based on the <meta-rubric evaluation feedback>, determine what aspects of the rubric need enhancement:
   - Criterion clarity and distinctiveness
   - Performance level descriptions
   - Logical progression between score levels
   - Alignment with assignment objectives
   - Language precision and professionalism

3. Comprehensive Revision: Systematically revise the entire rubric structure:
   - All Score Levels: Improve descriptions across all score levels to create clear, logical progressions
   - Criterion Definitions: Enhance clarity and distinctiveness of each criterion
   - Language Quality: Refine language for precision, consistency, and professionalism
   - Structural Coherence: Ensure all elements work together effectively
   - Assignment Alignment: Strengthen connections to the specific assignment context when applicable

4. Quality Assurance: Ensure your revised rubric:
   - Addresses all issues identified in the meta-rubric <meta-rubric evaluation feedback>
   - Maintains the original rubric structure (dimensions, percentages, score scale)
   - Creates clear distinctions between all performance levels
   - Demonstrates the improvements needed to achieve the target score

5. Output Formatting: Return a complete JSON object matching the exact structure of the input rubric, with all score levels revised as needed.
</instructions>

<output format>
Return the complete revised rubric as a JSON array maintaining the exact same structure as the <user rubric>, with all necessary improvements applied across all score levels. The output should preserve:
- All dimension names and descriptions (unless they need improvement based on feedback)
- All percentage weightings
- All existing score level keys (score_1, score_2, score_3, etc.)
- The "checked": false property for all score levels

Dynamically adapt to the number of score levels present in the input rubric. Your output structure should exactly match the input structure.
</output format>`

  console.log('prompt', prompt)

  message.push({
    "content": prompt,
    "role": "user",
  });

  // 使用openai的chat模型:
  const completion = await openai.chat.completions.create({
    messages: message,
    temperature: 0.1,
    model: "gpt-4.1",
    seed: Date.now(),
  });
  const responseMsg = completion.choices[0].message;

  console.log('responseMsg', responseMsg);
  return responseMsg;

}

function generateCounterfactualText(rubric, score, dimension) {
  // 获取当前选中的分数
  const currentScore = Object.entries(rubric).find(([_, value]) => value.checked === true);
  const targetScore = Object.entries(rubric).find(([_, value]) => {
    console.log('value', value);
    console.log('_', _);
    return _ === 'score_' + score;
  });
  console.log('currentScore', currentScore);
  console.log('targetScore', targetScore);
  const currentScoreText = `score_${currentScore[0].slice(-1)}: ${currentScore[1].text}`;

  const dimensionText = `Dimension: ${dimension.dimension} - ${dimension.description} (${dimension.percentage}%)`;
  // 生成评分标准文本
  const rubricText = Object.entries(rubric)
    .map(([key, value]) => `score_${key.slice(-1)}: ${value.text}`)
    .reverse() // 反转数组使得分数从高到低排列
    .join('\n');

  // 告知是提升还是降低
  const isImprove = score > currentScore[0].slice(-1);
  const isImproveText = isImprove ? 'improve' : 'reduce';

  // 生成完整的反馈文本
  return `${dimensionText}\n${rubricText}\nThe <user rubric> got score_${currentScore[0].slice(-1)} for this rubric, the reason is: ${currentScore[1].reason}. \nThe reason of not getting score_${score} is: ${targetScore[1].reason}`;
}

/**
 * Convert criteria structure to text format
 * @param {Array} criteriaArray - The criteria array structure
 * @returns {string} - Formatted text representation of the criteria
 */
function convertCriteriaToText(criteriaArray) {
  if (!criteriaArray || !Array.isArray(criteriaArray) || criteriaArray.length === 0) {
    return '';
  }

  let textOutput = '';

  criteriaArray.forEach((criterion, index) => {
    if (index > 0) {
      textOutput += '\n'; // Add newline between multiple criteria if needed
    }

    // Get all score keys and sort them (score_1, score_2, etc.)
    const scoreKeys = Object.keys(criterion).filter(key => key.startsWith('score_'));
    scoreKeys.sort((a, b) => {
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    });

    // Convert each score to text format
    scoreKeys.forEach(scoreKey => {
      const scoreData = criterion[scoreKey];
      if (scoreData && scoreData.text) {
        textOutput += `${scoreKey}: ${scoreData.text}\n`;
      }
    });
  });

  return textOutput.trim();
}

/**
 * Convert criteria structure and add reason field with random checked selection
 * @param {Array} criteriaArray - The criteria array structure
 * @returns {Array} - Enhanced criteria array with reason fields and one random checked selection
 */
function addReasonToCriteria(criteriaArray) {
  if (!criteriaArray || !Array.isArray(criteriaArray) || criteriaArray.length === 0) {
    return [];
  }

  const processedCriteria = criteriaArray.map(criterion => {
    const scoreKeys = Object.keys(criterion).filter(key => key.startsWith('score_'));

    // Randomly select one score to be checked
    const randomIndex = Math.floor(Math.random() * scoreKeys.length);
    const checkedScoreKey = scoreKeys[randomIndex];

    const processedCriterion = {};

    scoreKeys.forEach(scoreKey => {
      const originalScore = criterion[scoreKey];
      processedCriterion[scoreKey] = {
        checked: scoreKey === checkedScoreKey,
        text: originalScore.text,
        reason: scoreKey === checkedScoreKey
          ? "Overall evaluation of the score (1–2 sentences), followed by a bulleted list of specific reasons, evidence, or examples that support why the score was selected. This field should be a string of markdown format with line breaks, not a list."
          : "Overall evaluation of the score (1–2 sentences), followed by a bulleted list of specific reasons, evidence, or examples that support why the score was not selected. This field should be a string of markdown format with line breaks, not a list."
      };
    });

    return processedCriterion;
  });

  return processedCriteria;
}

async function getGistRubricList() {
  const gistId = '8e5525adad4276955dedf9f46fc84148';

  try {
    const data = await getGistData(gistId);
    if (!data || !data.files) {
      return [];
    }

    const feedbackComments = Object.keys(data.files).map(fileName => ({
      name: fileName,
      content: JSON.parse(data.files[fileName].content)
    }));

    return feedbackComments;
  } catch (error) {
    console.error('Error fetching the Gist:', error);
    return []; // 发生错误时返回空数组
  }
}

/**
 * Update Gist content
 * @param {string} fileName - The name of the file to update
 * @param {string} content - The stringified JSON content
 * @returns {Promise<Object>} - The response from GitHub API
 */
async function updateGistContent(fileName, content) {
  const gistId = '8e5525adad4276955dedf9f46fc84148';

  try {
    const files = {
      [fileName]: content
    };

    const data = await updateGistData(gistId, files);
    return data;
  } catch (error) {
    console.error('Error updating Gist:', error);
    throw error;
  }
}

/**
 * Convert rubric structure to text format
 * @param {Array} rubricArray - The rubric array structure
 * @returns {string} - Formatted text representation of the rubric
 */
function convertRubricToText(rubricArray) {
  if (!rubricArray || !Array.isArray(rubricArray)) {
    return '';
  }

  let textOutput = '';

  rubricArray.forEach((dimension, index) => {
    // Add dimension header
    textOutput += `${index + 1}. ${dimension.dimension}`;
    if (dimension.description) {
      textOutput += ` - ${dimension.description}`;
    }
    textOutput += ` (${dimension.percentage}%)\n`;

    // Add criteria for each score level
    if (dimension.criteria && dimension.criteria.length > 0) {
      const criterion = dimension.criteria[0]; // 假设每个dimension只有一个criteria对象

      // 按分数从高到低排序 (score_4 到 score_1)
      const scores = ['score_6', 'score_5', 'score_4', 'score_3', 'score_2', 'score_1'];

      scores.forEach(scoreKey => {
        if (criterion[scoreKey]) {
          const scoreNumber = scoreKey.split('_')[1];
          textOutput += `score_${scoreNumber}:`;
          textOutput += `${criterion[scoreKey].text}\n`;
        }
      });
    }

    textOutput += '\n';
  });

  return textOutput.trim();
}

export { getRubricBasicFeedback, getOrImproveCriterion, getGistRubricList, updateGistContent, getSubRubric, refineDescription, recommendCriterion, elaborateDescription, getRubricBasedFeedback, convertRubricToText, generateCounterfactualRubric }


