import OpenAI from 'openai';
import fs from 'node:fs';
import * as path from 'path';

const fsCache = {
  set: (key, value) => {
    fs.writeFileSync(path.join(process.cwd(), `llm-cache/${key}.json`), JSON.stringify(value, null, 2));
  },
  get: (key) => {
    let path = `./llm-cache/${key}.json`;
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
};

export default class Llm {
  constructor({ apiKey, model = 'gpt-4' }) {
    this.apiKey = apiKey;
    this.model = model;
    this.openai = new OpenAI({ apiKey });
  }

  async call(messages, functions) {
    const key = constructCacheKey(messages)
    const cached = fsCache.get(key);
    if (cached) {
      console.log(`[LLM] using cache`)
      return cached;
    }

    console.log(`[OpenAI] calling: ${messages.length} messages`)
    let aiResRaw = await this.openai.chat.completions.create({
      model: this.model,
      messages,
      functions,
    });
    let aiResCore = aiResRaw.choices[0];
    fsCache.set(key, aiResCore);
    return aiResCore
  }
}

function constructCacheKey(messages) {
  const numOfLetters = 12;
  let result = "";

  for (let message of messages) {
    let prefix = "";
    switch (message.role) {
      case "system":
        prefix = "[s]";
        break;
      case "user":
        prefix = "[u]";
        break;
      case "assistant":
        prefix = "[a]";
        break;
    }


    let start = message.content.slice(0, numOfLetters);
    let end = message.content.slice(-numOfLetters);
    result += prefix + keyify(start) + "|" + keyify(end);
  }

  return result;
}

function toCamel(s) {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
}

function toSlug(s) {
  return s
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
}

function keyify(s) {
  s = toCamel(s);
  s = toSlug(s);
  return s;
}
