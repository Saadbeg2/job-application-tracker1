# Gmail Classifier Fixtures

These fixtures document expected behavior for the rule-based Gmail classifier. The app does not currently have a test runner configured, so these cases are kept as lightweight reference fixtures for future unit tests.

## LinkedIn CareerXperts

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject: `Saad Salman, your application was sent to CareerXperts Consulting`
- Snippet/body lines:
  - `Associate Software Engineer`
  - `CareerXperts Consulting · United States (Remote)`

Expected:

- `type`: `new_application`
- `company`: `CareerXperts Consulting`
- `role`: `Associate Software Engineer`
- `location`: `United States (Remote)`
- `suggestedStatus`: `Applied`
- `reason`: `LinkedIn body parser` or `LinkedIn subject parser` if body is unavailable

## Illumio / Ashby Role-at-Company

Input:

- Sender: `Ashby <notifications@ashbyhq.com>`
- Subject: `Thank you for applying for the Infrastructure Administrator I, Cloud AI Role at Illumio!`

Expected:

- `type`: `new_application`
- `company`: `Illumio`
- `role`: `Infrastructure Administrator I, Cloud AI`
- `suggestedStatus`: `Applied`
- `reason`: `Ashby role-at-company subject parser`

## LinkedIn Newsletter False Positive

Input:

- Sender: `LinkedIn <jobs-noreply@linkedin.com>`
- Subject/snippet: `Recommended jobs for you weekly digest unsubscribe`

Expected:

- `type`: `unknown_job_related`
- `confidence`: about `0.1`
- No ReviewItem should be created by Gmail scan because scan skips confidence `<= 0.2`.
