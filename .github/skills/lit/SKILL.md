---
name: lit
description: Guidelines for how to write lit-html and lit elements and derivatives.
---

# Skill Instructions

Writing lit-html and lit components:
* Always use when() directive for conditional rendering instead of ternary operators or &&.
* Indent the first line of the template so that it aligns with the enclosing statement (e.g. `return`), and indent all subsequent lines relative to that using tabs for HTML nesting.
* Always use directives if one exists for the use case.
* Always use map or repeat for iterating over arrays to produce templates.
* Always place the static styles at the bottom of the component class.
* Never use async in lifecycle methods like connected or disconnected callbacks. Create a separate protected async method and call it without await.
* Prefer to create event handler methods that can be directly assigned in the template and avoid inline functions in templates. These methods should also utilize the event target for gathering information related to the operation they are performing, instead of relying on closure state or assigned parameters.