## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimat Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Additional Guidelines

Do not ask or attempt to run the dev server at any point.
Always fix linting errors using the ESLint mcp server actions if possible, but do it manually if you cannot.
Use the test tools to run tests, do not ask to run cli commands for testing.
Always use protected methods and properties instead of private.

Writing lit-html and lit components:
* Always use when() directive for conditional rendering instead of ternary operators or &&.
* Indent the first line of the template so that it aligns with the enclosing statement (e.g. `return`), and indent all subsequent lines relative to that using tabs for HTML nesting.
* Always use directives if one exists for the use case.
* Always use map or repeat for iterating over arrays to produce templates.
* Always place the static styles at the bottom of the component class.
* Never use async in lifecycle methods like connected or disconnected callbacks. Create a separate protected async method and call it without await.
* Prefer to create event handler methods that can be directly assigned in the template and avoid inline functions in templates. These methods should also utilize the event target for gathering information related to the operation they are performing, instead of relying on closure state or assigned parameters.

Writing CSS or derived languages:
* Do not create a newline between each selector. But do create a newline when creating a new selector in a nested block.
* Always use multiline blocks.
* Always use shorthand properties where possible.
* Always use variables for colors, font sizes, spacing values, and other commonly reused values.
* Always use nesting to group related styles together.
* Always place related classes together in the stylesheet.
* Always order properties in a logical manner, such as positioning first, box model second, typography third, visual styles fourth, and miscellaneous last.
