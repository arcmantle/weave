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
