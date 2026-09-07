---
"@jeengbe/spiffe": major
---

feat!: `NoSvidError` no longer takes an SVID type

The type of the underlying SVID is an implementation detail of the client, so it is gone from
both the constructor and the message. The constructor now takes only the `hint`, which the
message mentions if it is set.
