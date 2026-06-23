import { date } from 'quasar';

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
  // 匹配包含 score 和 description 的 JSON 数组结构
  const jsonMatch = inputString.match(/\[\s*\{[\s\S]*"score"[\s\S]*"description"[\s\S]*\}\s*\]/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid JSON structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证是否为数组
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON structure must be an array");
    }

    // 验证数组中的对象结构
    jsonData.forEach((item, index) => {
      if (typeof item.score !== 'number' || typeof item.description !== 'string') {
        throw new Error(`Item ${index + 1} is missing required fields or has invalid types`);
      }
    });

  } catch (error) {
    console.error("JSON parsing failed:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatDateTime(timestamp) {
  return date.formatDate(timestamp, 'YYYY/MM/DD HH:mm:ss');
};

function formatContent(content) {
  return content.replace(/\n/g, '<br>');
}

function formatCriterionString(inputString) {
  // 匹配包含 score_ 开头的对象结构
  const jsonMatch = inputString.match(/\{[\s\S]*"score_[\d]+"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid criterion structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证对象结构
    Object.keys(jsonData).forEach(key => {
      if (!key.startsWith('score_') ||
          typeof jsonData[key].text !== 'string' ||
          typeof jsonData[key].checked !== 'boolean') {
        throw new Error(`Invalid criterion structure for ${key}`);
      }
    });

  } catch (error) {
    console.error("Failed to parse criterion JSON:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatCriterionWithName(inputString) {
  // 匹配包含 name 和 criteria 的对象结构
  const jsonMatch = inputString.match(/\{[\s\S]*"name"[\s\S]*"criteria"[\s\S]*"score_[\d]+"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid criterion with name structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证对象结构
    if (typeof jsonData.name !== 'string') {
      throw new Error("Missing or invalid 'name' field");
    }

    if (!jsonData.criteria || typeof jsonData.criteria !== 'object') {
      throw new Error("Missing or invalid 'criteria' field");
    }

    // 验证 criteria 对象中的 score_ 结构
    Object.keys(jsonData.criteria).forEach(key => {
      if (!key.startsWith('score_') ||
          typeof jsonData.criteria[key].text !== 'string' ||
          typeof jsonData.criteria[key].checked !== 'boolean') {
        throw new Error(`Invalid criterion structure for ${key} in criteria`);
      }
    });

  } catch (error) {
    console.error("Failed to parse criterion with name JSON:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatTaskString(inputString) {
  // 匹配包含 task 的对象结构
  const jsonMatch = inputString.match(/\{[\s\S]*"task"[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid task structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证对象结构
    if (typeof jsonData.task !== 'string') {
      throw new Error("Missing or invalid 'task' field");
    }

  } catch (error) {
    console.error("Failed to parse task JSON:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatRubricString(inputString) {
  // 匹配包含 dimension, description, percentage, criteria 的数组结构
  const jsonMatch = inputString.match(/\[\s*\{[\s\S]*"dimension"[\s\S]*"description"[\s\S]*"percentage"[\s\S]*"criteria"[\s\S]*\}\s*\]/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid rubric structure.");
    return null;
  }

  // 解析 JSON
  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);

    // 验证是否为数组
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON structure must be an array");
    }

    // 验证数组中的对象结构
    jsonData.forEach((item, index) => {
      // 验证必需字段
      if (typeof item.dimension !== 'string') {
        throw new Error(`Item ${index + 1} is missing or has invalid 'dimension' field`);
      }
      if (typeof item.description !== 'string') {
        throw new Error(`Item ${index + 1} is missing or has invalid 'description' field`);
      }
      if (typeof item.percentage !== 'number') {
        throw new Error(`Item ${index + 1} is missing or has invalid 'percentage' field`);
      }

      // 验证 criteria 数组
      if (!Array.isArray(item.criteria)) {
        throw new Error(`Item ${index + 1} is missing or has invalid 'criteria' field`);
      }

      // 验证 criteria 数组中的评分标准
      item.criteria.forEach((criterion, criterionIndex) => {
        Object.keys(criterion).forEach(key => {
          if (!key.startsWith('score_') ||
              typeof criterion[key].text !== 'string' ||
              typeof criterion[key].checked !== 'boolean') {
            throw new Error(`Invalid criterion structure for ${key} in item ${index + 1}, criterion ${criterionIndex + 1}`);
          }
        });
      });
    });

  } catch (error) {
    console.error("Failed to parse rubric JSON:", error);
    return null;
  }

  // 格式化输出 JSON
  return JSON.stringify(jsonData, null, 2);
}

function formatScoreReasonString(inputString) {
  // 匹配包含 score_X 结构的数组，其中包含 checked, text, reason 字段
  const jsonMatch = inputString.match(/\[\s*\{[\s\S]*"score_[\d]+"[\s\S]*"checked"[\s\S]*"text"[\s\S]*"reason"[\s\S]*\}\s*\]/);

  if (!jsonMatch) {
    console.error("Input string does not contain a valid score-reason structure.");
    return null;
  }

  // 预处理JSON字符串，修复reason字段中的引号问题
  let jsonString = jsonMatch[0];

  try {
    // 首先尝试直接解析
    let jsonData = JSON.parse(jsonString);

    // 验证是否为数组
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON structure must be an array");
    }

    // 验证数组中的对象结构
    jsonData.forEach((item, index) => {
      Object.keys(item).forEach(key => {
        if (!key.startsWith('score_')) {
          throw new Error(`Invalid key ${key} in item ${index + 1}`);
        }

        const scoreData = item[key];
        if (typeof scoreData.checked !== 'boolean' ||
            typeof scoreData.text !== 'string' ||
            typeof scoreData.reason !== 'string') {
          throw new Error(`Invalid score structure for ${key} in item ${index + 1}`);
        }
      });
    });

    // 直接返回格式化的 JSON，保持reason字段的原始字符串格式
    return JSON.stringify(jsonData, null, 2);

  } catch (parseError) {
    console.warn("Direct JSON parsing failed, attempting to fix reason field quotes:", parseError.message);

    // 如果直接解析失败，尝试修复reason字段中的引号问题
    // 使用简单但有效的方法：找到reason字段并重新格式化其值
    jsonString = jsonString.replace(
      /"reason"\s*:\s*"([^"]*(?:"[^"]*)*[^"]*)"/g,
      (match, reasonContent) => {
        // 转义reason内容中的所有引号
        const escapedContent = reasonContent.replace(/"/g, '\\"');
        return `"reason": "${escapedContent}"`;
      }
    );

    // 处理更复杂的情况：reason字段可能跨越多行或包含特殊字符
    jsonString = jsonString.replace(
      /"reason"\s*:\s*"([^"]*)"([^"]*"[^"]*)*"([^"]*)"(?=\s*[,}])/g,
      (match) => {
        // 提取reason字段的完整内容
        const reasonStart = match.indexOf('"reason"');
        const colonIndex = match.indexOf(':', reasonStart);
        const valueStart = match.indexOf('"', colonIndex) + 1;
        const valueEnd = match.lastIndexOf('"');

        if (valueStart > 0 && valueEnd > valueStart) {
          const reasonValue = match.substring(valueStart, valueEnd);
          const escapedValue = reasonValue.replace(/"/g, '\\"');
          return `"reason": "${escapedValue}"`;
        }
        return match;
      }
    );

    try {
      // 再次尝试解析修复后的JSON
      let jsonData = JSON.parse(jsonString);

      // 验证是否为数组
      if (!Array.isArray(jsonData)) {
        throw new Error("JSON structure must be an array");
      }

      // 验证数组中的对象结构
      jsonData.forEach((item, index) => {
        Object.keys(item).forEach(key => {
          if (!key.startsWith('score_')) {
            throw new Error(`Invalid key ${key} in item ${index + 1}`);
          }

          const scoreData = item[key];
          if (typeof scoreData.checked !== 'boolean' ||
              typeof scoreData.text !== 'string' ||
              typeof scoreData.reason !== 'string') {
            throw new Error(`Invalid score structure for ${key} in item ${index + 1}`);
          }
        });
      });

      // 直接返回格式化的 JSON，保持reason字段的原始字符串格式
      return JSON.stringify(jsonData, null, 2);

    } catch (secondError) {
      console.error("Failed to parse score-reason JSON after attempting fixes:", secondError);
      console.error("Original input:", inputString.substring(0, 500) + '...');
      console.error("Processed JSON string:", jsonString.substring(0, 500) + '...');
      return null;
    }
  }
}

export { formatToString, formatToNewString, formatDateTime, formatContent, formatCriterionString, formatCriterionWithName, formatTaskString, formatRubricString, formatScoreReasonString }
