import e2b from '@e2b/sdk';
import { exec } from 'child_process';
import * as path from 'path';
import Llm from './llm.js';
import { stripIndent } from 'common-tags';
import * as assert from 'assert';
import fs from 'node:fs';
import { containsErrors, resolveRelativeTo } from './utils.js';

// TODO: Implement also cloud mode 
process.env.AIFIX_ENV = 'local'
process.env.AIFIX_LOCAL_CWD = path.join(process.cwd(), '../subject') // TODO: Make configurable
process.env.CLI_TEST_COMMAND ??= 'npm test';

const llm = new Llm({ apiKey: process.env.OPENAI_API_KEY })

async function runTests() {
  if (process.env.AIFIX_ENV === "local") {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const { signal } = controller;
      let stdout = ''
      let stderr = ''
      
      const child = exec(process.env.CLI_TEST_COMMAND, {
        cwd: process.env.AIFIX_LOCAL_CWD,
        signal,
      }, (err, stdout, stderr) => {
        // console.log('🔴', err)
        // console.log('🟡', stderr)
        // console.log('🟢', stdout)
        stderr += stderr
        stdout += stdout
        resolve(stderr) // we care about stderr, where testing framework should print the errors
      })
    })
  } else {
    const session = await e2b.Session.create({ id: 'Nodejs', apiKey: process.env.E2B_API_KEY })
  }
}

async function askForError(errString) {
  if (process.env.AIFIX_ENV === "local") {
    const llmRes = await llm.call([
      {
        role: 'system',
        content: stripIndent`
          You are a software engineer debugging existing project.
          You are given a full output from failing test run.
          You need to parse the message and in that: 
          - test file name
          - test failure description/message
          - test failure location within the file
          Call the get_more_context function with the above parameters.
        `,
      },
      { role: 'user', content: errString }
    ], [{
      name: 'get_more_context',
      description: 'Based on detected attributes, get more context about the error',
      parameters: {
        type: 'object',
        properties: {
          testFilePath: {
            type: 'string',
            description: 'The path to the test file',
          },
          testFailDescription: {
            type: 'string',
            description: 'The description of the test failure',
          },
          errorLocation: {
            type: 'number',
            description: 'The location (row number) of the error within the file',
          }
        }
      }
    }])
    assert.ok(llmRes.finish_reason === 'function_call')
    assert.ok(llmRes.message.function_call.name === 'get_more_context')
    // TODO: More forgiving parsing
    return JSON.parse(llmRes.message.function_call.arguments)
  }
}

async function askForErrorOrigin({ testFilePath, testFailDescription, errorLocation }) {
  const testContent = fs.readFileSync(path.join(process.env.AIFIX_LOCAL_CWD, testFilePath), 'utf8')
  if (process.env.AIFIX_ENV === "local") {
    const llmRes = await llm.call([
      {
        role: 'system',
        content: `You are a software engineer debugging existing project.`,
      },
      {
        role: 'user',
        content: stripIndent`
          The following test file is failing: """
          ${testContent}
          """
          
          It fails with the following error: "${testFailDescription}" at line ${errorLocation}.
          Find out what is the root cause of the error.
          If the root cause is from a dependency, find out which one and respond with the path to the file.
        `
      }
    ], [{
      name: 'get_dependency',
      description: 'Get file content of the dependency',
      parameters: {
        type: 'object',
        properties: {
          dependencyPath: {
            type: 'string',
            description: 'The path to the dependency file',
          }
        }
      }
    }])
    assert.ok(llmRes.finish_reason === 'function_call')
    assert.ok(llmRes.message.function_call.name === 'get_dependency')
    // TODO: More forgiving parsing
    return JSON.parse(llmRes.message.function_call.arguments)
  }

}

async function askForFix({ originPath, testFailDescription }) {
  const fileContent = fs.readFileSync(path.join(process.env.AIFIX_LOCAL_CWD, originPath), 'utf8')
  if (process.env.AIFIX_ENV === "local") {
    const llmRes = await llm.call([
      {
        role: 'system',
        content: `You are a software engineer debugging existing project.`,
      },
      {
        role: 'user',
        content: stripIndent`
          The following file: """
          ${fileContent}
          """
          
          Is causing the following error in test suite: """
          ${testFailDescription}
          """
          Try to fix the error.
          Call the write_code function with the fixed code.
        `
      }
    ], [{
      name: 'write_code',
      description: 'Writes generated code to the file',
      parameters: {
        type: 'object',
        properties: {
          fileContent: {
            type: 'string',
            description: 'The fixed code',
          }
        }
      }
    }])
    assert.ok(llmRes.finish_reason === 'function_call')
    assert.ok(llmRes.message.function_call.name === 'write_code')
    // TODO: More forgiving parsing
    return JSON.parse(llmRes.message.function_call.arguments).fileContent
  }
}

async function main() {
  const errString = await runTests()
  if (!containsErrors(errString)) return console.log(`No failing tests, exiting.`)
  const { testFilePath, testFailDescription, errorLocation } = await askForError(errString)
  const { dependencyPath } = await askForErrorOrigin({ testFilePath, testFailDescription, errorLocation })
  const resolvedOrigin = resolveRelativeTo(testFilePath, dependencyPath)
  const fixedCode = await askForFix({ originPath: resolvedOrigin, testFailDescription })
  fs.writeFileSync(path.join(process.env.AIFIX_LOCAL_CWD, resolvedOrigin), fixedCode)
  const errStringFixed = await runTests()
  if (containsErrors(errStringFixed)) {
    console.log(`🤔 Running tests again after fix still fails – human intervention required.`)
  } else {
    console.log(`✅ Auto-fix successful, review the changes and commit.`)
  }
}

await main()
  
