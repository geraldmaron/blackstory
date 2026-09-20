# Lives: audio sources, as verified

Research record, 2026-09-20. Everything here was read from the holding institution's own record in
that session. Nothing is from memory. Anything not verified is listed as not verified.

## How the Library of Congress can be read

The loc.gov HTML pages sit behind a bot check. It was not worked around. The Library's own JSON API
answers a plain, identified request: append `?fo=json` to a collection or item URL and send a
User-Agent that names the project and a contact. Files on `tile.loc.gov` load directly. Requests
were spaced at least three seconds apart.

## Voices Remembering Slavery: Freed People Tell Their Stories

American Folklife Center, Library of Congress.
`https://www.loc.gov/collections/voices-remembering-slavery/about-this-collection/?fo=json`

What the Library says, in its words:

- The recordings "took place between 1932 and 1975 in nine states." There are "Twenty-two
  interviewees." The collection lists 66 items, because many interviews run to several parts.
- "all of the interviewees spoke sixty or more years after the end of their enslavement, and it is
  their full lives that are reflected in these recordings." They "have much to say about living as
  African Americans from the 1870s to the 1930s, and beyond." This is why the recordings belong on a
  page whose spine starts in 1870.
- "All known recordings of former slaves in the American Folklife Center are included."
- "not all the recordings are clearly audible."
- A further "2300 non-audio interviews with ex-slaves" are in *Born in Slavery: Slave Narratives
  from the Federal Writers' Project, 1936-1938*.

**A correction to a common claim.** The Library does not say these are the only recordings of
formerly enslaved people. It says they are all the known ones in the American Folklife Center. Lives
must not print the stronger claim.

**Who held the microphone.** The Library names the fieldworkers. They include Black scholars:
Lorenzo Dow Turner (Gullah areas of South Carolina and Georgia, 1932 and 1933), Zora Neale Hurston
(with Alan Lomax and Mary Elizabeth Barnicle, 1935), Charles S. Johnson, Lewis W. Jones and John W.
Work (the Library and Fisk University, Mississippi, 1941), and Roscoe E. Lewis (Virginia, 1937 to
1940, with the Federal Writers' Project). The caution often attached to the written WPA narratives,
that white interviewers in the segregated South shaped what was said, therefore does not transfer
to these recordings wholesale. Each account names its own interviewer.

**Rights.** From the collection's rights page: "The Library of Congress is unaware of any copyright
or other restrictions in the Voices Remembering Slavery Collection. Absent any such restrictions,
these materials are free to use and reuse." The Center also asks for "respect for the culture and
sensibilities of the people whose lives, ideas, and creativity are documented here," and notes that
privacy and publicity rights may pertain to some uses. The credit line names the source collection,
its number, and the repository, for example "Cyrus B. Koonce Collection (AFC 1950/037), American
Folklife Center, Library of Congress".

## Media host and streaming

Every item's audio, transcript, and PDF sit on `tile.loc.gov`, a host the web content security
policy already allows for images. Checked on the Fountain Hughes recording:

| Check | Result |
|---|---|
| Content type | `audio/mpeg` |
| Size | 19,711,987 bytes |
| `accept-ranges` | `bytes` |
| Range request (what an audio element sends) | `206`, partial content |
| `access-control-allow-origin` | `*` |

So an inline player needs one new directive, `media-src`, with one host that is already trusted.
Nothing is rehosted, which also keeps the oral-history adapter's rule: pointers and short quotes
only, never audio or full transcripts.

## Item verified in full

Interview with Fountain Hughes, Baltimore, Maryland, June 11, 1949.
`https://www.loc.gov/item/afc1950037_afs09990a/?fo=json`

- Recorded by Hermond Norwood, whom the Library describes as "a Library of Congress engineer at the
  time." Cyrus B. Koonce collection (AFC 1950/037). Call number AFC 1950/037: AFS 09990A.
- Audio: `https://tile.loc.gov/storage-services/service/afc/afc1950037/afc1950037_afs09990/afc1950037_afs09990a.mp3`
- Transcript: the same path ending `.xml` or `.pdf`.
- From the Library's transcript, verbatim: "We didn't have no property. We didn't have no home. We
  had nowhere or nothing." Also: "I never bought nothing on time in my life."
- In the recording he says he was born in Charlottesville, Virginia, that his grandfather "belong
  to Thomas Jefferson," and that he is 101. These are his statements and are attributed as such.

## Not yet verified

- Transcripts of the other 65 items have not been read. Each one used on Lives is read first.
- Other audio collections named as leads (Duke's Behind the Veil, the Civil Rights History Project,
  the UNC Southern Oral History Program, Lomax field recordings of work songs) have not been opened.
  Each needs its own rights record before any item is used.
