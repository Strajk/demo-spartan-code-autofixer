# demo-spartan-code-autofixer

- `/subject` contains a sample node project:
  - `main.js` file with a `sum` function that is broken 😱
  - but, it we have tests in `/jest`, `/vitest`, and `/assert` in respective testing frameworks, all are failing, as expected

- `/agent` contains an "AI agent", in quotes because in reality, it's kinda simple node script that:
  - runs the specified `test` script in the context of the `subject` project 
  - when the tests fails, it will try to fix the code:
    - asks AI to get info from the failing test output (e.g. testing sum with 1 and 2, expected 3, got -1)
    - asks AI which files it should read to get the origin of the failing test (e.g. `main.js`)
    - asks AI to fix the code, providing it with the code & failing test explanation

It's intentionally written as chain of AI prompts with no code parsing, so it should work with any testing framework, probably even with various programming languages.

Note that this a just a simplistic demo and it's written as such.
