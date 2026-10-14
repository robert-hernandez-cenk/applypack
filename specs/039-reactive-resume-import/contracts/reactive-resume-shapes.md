# Contract: the Reactive Resume shapes we read

**Unverified against a live instance.** Written from docs.rxresu.me (v6 schema guide) and the v4 file layout. Fixtures in `src/resume/fixtures/reactive-resume/` are hand-written to these shapes. Everything is read tolerantly: a missing key is an empty value, an unknown key is ignored.

## v6 (documented)

```text
basics:   name, headline, email, phone, location, website{url,label}, customFields[{text,link}]
summary:  { title, hidden, content(HTML) }
sections: <name>: { title, hidden, items[] }          name ∈ profiles experience education projects skills
                                                       languages interests awards certifications publications
                                                       volunteer references
items:    { id, hidden, ...fields below }
experience: company position location period dates{start,end,present,raw} website{url,label} description(HTML) roles[{position period dates description}]
education:  school degree area grade location period dates description
skills:     name proficiency level keywords[]
projects:   name period dates website description
languages:  language fluency level
certifications / awards / publications: title issuer|awarder|publisher date dates website description
volunteer:  organization location period dates description
interests:  name keywords[]          profiles: network username website
references: name position phone description
customSections[]: { id, type, title?, items? }   — read as plain text only when they carry text
```

Dates: `start`/`end` are `null`, `"YYYY"` or `"YYYY-MM"`; `present` true → "Present"; `raw` wins when start and end are both null.

## v5 (inferred)

As v6 but no `dates` object (read `period`/`date` strings), no `roles`, `basics.url{label,href}` or `basics.website`, `summary` may be `{content}` or a string.

## v4

```text
basics:   name headline email phone location url{label,href}
sections: summary{content,visible} experience{items[{company position location date summary url{href} visible}]}
          education{items[{institution studyType area score date summary visible}]}
          skills{items[{name description level keywords[] visible}]}
          projects{items[{name description date summary keywords[] url visible}]}
          languages{items[{name description level visible}]} … (awards, certifications, publications,
          volunteer, interests, references, profiles use the same item-with-visible form)
```

## API answers (v5/v6 instance)

- list: an array of `{ id, name, slug, ... }` or an object holding such an array (`items`/`resumes`/`data`); anything else → not Reactive Resume.
- get: `{ id, name, slug, data: <v5/v6 resume data> }`.
