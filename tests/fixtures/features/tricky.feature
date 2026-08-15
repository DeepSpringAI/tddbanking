@capability:tricky
Feature: Parser edge cases

  # evidence: a comment sitting between the tag block and the Scenario keyword is legal
  # Gherkin and is exactly what a naive regex misses
  @draft @from-story:doc-1 @priority:high
  # a second comment, after the tags, before the keyword
  Scenario: Comment between tags and keyword
    Given something
    Then something

  @from-crawl @priority:medium @smoke
  Scenario: Live scenario with no draft tag
    Given something
    Then something

  # evidence: observed
  # blocked: needs a fixture nobody has seeded
  @draft @from-crawl @priority:high
  Scenario: Blocked draft
    Given something
    Then something

  @draft @from-story:doc-2 @gap-suspected @priority:high
  # evidence: promised in doc-2, absent from code
  Scenario Outline: An outline counts once
    Given <thing>
    Then something

    Examples:
      | thing |
      | a     |
      | b     |

  @from-crawl @smoke @known-defect @defect-change:F-9
  Scenario: A known defect
    Given something
    Then something

  @draft @from-crawl @priority:low
  Scenario: A draft with no evidence comment at all
    Given something
    Then something
