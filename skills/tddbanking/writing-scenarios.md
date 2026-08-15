# Writing scenarios

## Declarative, not imperative

A scenario states what the user achieves. It never states how the interface is operated.

```gherkin
# Wrong — this is a Playwright script wearing a Gherkin costume.
Scenario: Transfer money
  Given I navigate to "/login"
  And I fill "#email" with "alice@example.com"
  And I fill "#password" with "hunter2"
  And I click "#submit"
  And I click the link "Transfers"
  ...
```

```gherkin
# Right — survives a redesign, reads like a requirement.
Scenario: Transferring within balance moves the money
  Given I am signed in as "alice@example.com"
  When I transfer 50 EUR to "bob@example.com"
  Then my balance decreases by 50 EUR
```

The test: **if the front end were rewritten with different markup, would this scenario still
be correct?** If no, it is imperative — rewrite it. Imperative Gherkin is the main reason BDD
adoptions fail; it costs the ceremony of two languages and buys nothing, because the feature
file becomes as brittle as the selectors inside it.

## One behavior per scenario

A scenario asserts one thing. When it fails you should know what broke from its name alone.
Multiple `When`/`Then` pairs in one scenario means it is two scenarios.

`Background` is for shared setup that is genuinely irrelevant to what is being asserted —
signing in, seeding a fixture. If the setup is part of what you are testing, it belongs in
the scenario.

## Thin steps, fat page objects

Step definitions translate a sentence into an intent. They contain no locators.

```ts
// steps/transfers.ts — thin, and it builds its own page object.
When('I transfer {int} EUR to {string}', async ({ page }, amount, recipient) => {
  await new TransfersPage(page).transfer(amount, recipient);
});
```

Constructing the Page Object here rather than registering it as a shared fixture is what lets
capabilities be implemented in parallel: `steps/fixtures.ts` stays a file nobody has to edit,
so nobody conflicts over it.

```ts
// pages/TransfersPage.ts — every selector lives here.
export class TransfersPage extends BasePage {
  private readonly amount = this.page.getByLabel('Amount');
  private readonly recipient = this.page.getByLabel('Recipient');
  private readonly submit = this.page.getByRole('button', { name: 'Send' });

  async transfer(amount: number, recipient: string) {
    await this.amount.fill(String(amount));
    await this.recipient.fill(recipient);
    await this.submit.click();
  }
}
```

A locator that appears in a step definition is a bug in the test suite. When the markup
changes, exactly one file should need editing.

## Prefer user-facing locators

`getByRole`, `getByLabel`, `getByText` over CSS and XPath. They break when the user
experience breaks, which is the only time a browser test should break. A `.css-1x9dfk2`
selector fails on a style refactor that no user would notice.

## Quote the data, not the prose

Values a step should parameterize go in quotes. `Given I am working as a "Compliance Officer"`
generates one reusable step; `Given I am working as a Compliance Officer` generates a
single-purpose step, and you will write a near-duplicate for every role.

Quote roles, names, identifiers and amounts. Leave the surrounding sentence unquoted. Drafts
written by discovery often miss this — it is a normal and expected correction when taking a
scenario live, and it does not change the behavior the scenario asserts, so traceability to
the spec is preserved.

Note that `bddgen` validates step signatures: a `{string}` in the text with no matching
function argument fails generation with an arity error rather than at runtime.

## Reuse steps before writing new ones

Search the existing step definitions first. Duplicate steps with slightly different wording
("I sign in as", "I log in as", "I am logged in as") are how a suite becomes unmaintainable.
Parameterize instead: `{string}`, `{int}`, and `Scenario Outline` with an `Examples` table
for data-driven cases.

## Waiting

Never `waitForTimeout`. Use web-first assertions (`await expect(locator).toBeVisible()`) —
they retry, and they express what is being waited for. A fixed sleep is either flake or
wasted time, usually both.

## Naming

The scenario name is what a triager reads at 2am in CI output. `Transferring more than the
balance is refused` is useful; `Test transfer 2` is not. Name the behavior and its outcome.
