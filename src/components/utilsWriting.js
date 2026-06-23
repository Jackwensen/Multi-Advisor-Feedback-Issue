function formatToString(inputString) {
  const jsonMatch = inputString.match(/\[\s*\{[\s\S]*\}\s*\]/);

  if (jsonMatch) {
    return jsonMatch[0];
  }

  console.error("No JSON array found in input:", inputString);
  return null;
}

function extractRevisedWritingWithReason(inputString) {
  const jsonMatch = inputString.match(/\{[\s\S]*"revised_writing"[\s\S]*"reason"[\s\S]*\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Error parsing revised writing JSON:", error);
      return { revised_writing: inputString, reason: [] };
    }
  }

  console.error("No revised writing JSON found in input:", inputString);
  return { revised_writing: inputString, reason: [] };
}

export { formatToString, extractRevisedWritingWithReason };
