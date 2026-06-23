function formatToString(inputString) {
  // 删除无关文本，保留 JSON 部分
  const jsonMatch = inputString.match(/\[\s*\{[\s\S]*\}\s*\]/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid JSON structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatToNewString(inputString) {
  // 尝试匹配包含 overall_score 和 feedback 的 JSON 结构
  const jsonMatch = inputString.match(/\{[\s\S]*"overall_score"[\s\S]*"feedback"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("输入字符串不包含有效的评分反馈结构");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证必要的字段
    if (!jsonData.overall_score || !Array.isArray(jsonData.feedback)) {
      throw new Error("JSON 结构缺少必要字段");
    }

    // 验证 feedback 数组中的对象结构
    jsonData.feedback.forEach((item, index) => {
      if (!item.original_content || !item.suggested_revision || !item.explanation) {
        throw new Error(`反馈项 ${index + 1} 结构不完整`);
      }
    });

  } catch (error) {
    console.error("JSON 解析失败:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function extractRevisedWriting(inputString) {
  // 匹配 JSON 对象结构
  const jsonMatch = inputString.match(/\{[\s\S]*"revised_writing"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid JSON structure with revised_writing.");
    return null;
  }

  // 解析 JSON
  try {
    const jsonData = JSON.parse(jsonMatch[0]);
    return jsonData.revised_writing;  // 直接返回 revised_writing 的内容
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
}

function extractRevisedWritingWithReason(inputString) {
  // 匹配 JSON 对象结构
  const jsonMatch = inputString.match(/\{[\s\S]*"revised_writing"[\s\S]*"reason"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("输入字符串不包含有效的JSON结构（需要包含revised_writing和reason）");
    return null;
  }

  // 解析 JSON
  try {
    const jsonData = JSON.parse(jsonMatch[0]);
    // 验证必要的字段是否存在
    if (!jsonData.revised_writing || !jsonData.reason) {
      throw new Error("JSON结构缺少必要字段");
    }
    // 返回包含两个字段的对象
    return {
      revised_writing: jsonData.revised_writing,
      reason: jsonData.reason
    };
  } catch (error) {
    console.error("JSON解析失败:", error);
    return null;
  }
}

function formatDiffGroups(inputString) {
  // 匹配数组结构
  const arrayMatch = inputString.match(/\[\s*\[[\s\S]*\]\s*\]/);

  if (!arrayMatch) {
    console.error("输入字符串不包含有效的差异组数组结构");
    return null;
  }

  // 解析 JSON
  try {
    const jsonData = JSON.parse(arrayMatch[0]);

    // 验证数组结构
    if (!Array.isArray(jsonData)) {
      throw new Error("解析结果不是数组");
    }

    // 验证每个差异组的结构
    jsonData.forEach((group, index) => {
      if (!Array.isArray(group)) {
        throw new Error(`差异组 ${index + 1} 不是数组`);
      }
      group.forEach((item, itemIndex) => {
        if (!item.action || !item.text) {
          throw new Error(`差异组 ${index + 1} 的项目 ${itemIndex + 1} 结构不完整`);
        }
      });
    });

    return jsonData;
  } catch (error) {
    console.error("JSON解析失败:", error);
    return null;
  }
}

export { formatToString, formatToNewString, extractRevisedWriting, extractRevisedWritingWithReason, formatDiffGroups }
