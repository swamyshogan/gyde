# Send-to-GYDE

Send-to-GYDE is a protocol which allows applications to push arbitrary "data-frame-like"
data into a new GYDE dataset, and access many GYDE features in order to control how the
new dataset is displayed.

This directory contains minimal examples, as well as a more complex React-based application
which fetches data from ProSE+TAPIR before sending it on to GYDE.

## What can I send to GYDE?

GYDE will accept any tabular data.  If you can represent it as a spreadsheet, you can probably
send it to GYDE.  However, GYDE's feature set is focussed on sequence and structure analysis,
so in most cases the entries of your dataset (== rows of the table) will have one or more
sequences associated with them, and potentially structures (usually represented as URLs for
PDB files or similar) as well.

A typical small dataset might look like:

| seqid    | sequence      | calc_property  | structure_url                            |
|----------|---------------|----------------|------------------------------------------|
| entry1   | GYTSIVI       | 42.0           | https://files.rscb.org/download/1znf.pdb |
| entry2   | GYSTIVI       | 29.5           | https://files.rscb.org/download/2znf.pdb |

send-to-GYDE datasets are conceptually Javascript objects (which are encoded as JSON
for sending to GYDE).  Your core dataframe can be represented either in array-or-structures
or structure-of-arrays format (GYDE internally uses the latter, but for send-to-GYDE, use
whichever is most convenient).

So you can represent as either:

```
{
    data: [
        {
            seqid: 'entry1',
            sequence: 'GYTSIVI',
            calc_property: 42,
            structure_url: 'https://files.rscb.org/download/1znf.pdb'
        },
        {
            seqid: 'entry2',
            sequence: 'GYSTIVI',
            calc_property: 29.5,
            structure_url: 'https://files.rscb.org/download/2znf.pdb'
        }
    ],
    dataColumns: ['seqid', 'sequence', 'calc_properties', 'structure_url']  // NB this is needed when using SOA format
}
```

or

```
{
    columnarData: {
        seqid: ['entry1', entry2],
        sequence: ['GYTSIVI', 'GYSTIVI'],
        calc_property: [42, 29.5],
        structure_url: [
            'https://files.rscb.org/download/1znf.pdb',
            'https://files.rscb.org/download/1znf.pdb'
        ]
    }
}
```

Always represent numerical values as Javascript/JSON numbers rather than as strings.

Sequence data is treated as "special" by GYDE in a number of ways, but is stored as normal columns in the
main data frame.  However, you need to provded `seqColumns` metadata to name which column(s) are treated
as sequences.  For datasets with no sequences, `seqColumns` may be an empty array.

## Sending data

Most GYDE installations (including the GYDE local development server) provide a send-to-GYDE API endpoint
at /send-to-gyde

To send a dataset, POST to this URL using MIME multipart format.  The body if the request should include
a parameter names session_data which contains the JSON-encoded send-to-GYDE dataset.  Once received, the
GYDE backend will:

* [If not a local development instance] check that the user is logged in, and if necessary redirect
  to a suitable login flow.
* Store the POSTed data in the GYDE database, associated with the logged-in user.
* Redirect the current browser tab to the GYDE frontend, with URL parameters set such that the newly-saved
  session data is immediately loaded and displayed.

Generating appropriate requests from front-end web code is most easily accomplished by using an HTML
form and hooking the "formdata" event to attach the appropriate JSON-encoded data just before submission,
e.g.:

```
<!DOCTYPE html>
<html>
  <head>
    <title>Send-to-GYDE test</title>
  </head>
  <body>
    <form id="form" enctype="multipart/form-data" method="POST" action="http://localhost:3030/send-to-gyde" target="_blank">
        <input type="submit" value="Send to GYDE">
    </form>
    <script type="application/javascript">

      const columnarData = {
          seqid: ['seq1'],
          concept_name: ['Just testing'],
          sequence: ['HELLOWORLD']
      }
      const gydeSession = {
          // core data frame
          columnarData,
          // dataset metadata
          name: 'S2G test',
          alignmentKey: 'seqs',    // display plain sequences, rather than attempting to run an alignment
          isAntibody: false,
          seqColumns: ['sequence'],
          seqColumnNames: ['Test sequences']
      };

      document.querySelector('#form').addEventListener('formdata', (ev) => {
          const fd = ev.formData;
          fd.append(
            'session_data',
            new Blob([JSON.stringify(gydeSession)],
              {'type': 'application/json'})
          );
      });
    </script>
  </body>
</html>
```

You'll notice that this example uses `target="_blank"` to open the GYDE dataset in a new browser tab, but
this is optional.


If you do not want to use an HTML form to trigger the send-to-gyde action, you can use the following code
instead:

```
function sendToGYDE(gydeSession, gydeURL='http://localhost:3030') {
    const form = document.createElement('form');
    form.action = `${gydeURL}/send-to-gyde`
    form.target = '_blank';
    form.method = 'POST';
    form.enctype = 'multipart/form-data';

    document.body.appendChild(form);
    form.addEventListener('formdata', (ev) => {
        const fd = ev.formData;

        fd.append(
            'session_data',
            new Blob([JSON.stringify(gydeSession)],
                     {'type': 'application/json'})
        );
    });

    form.requestSubmit();
    Promise.resolve().then(() => {document.body.removeChild(form)});
}
```

We advise against using the `fetch` or `XMLHttpRequest` APIs to trigger send-to-gyde
submissions.  After submission, the user's browser may be required to follow several
redirects (e.g. for login), and reliably dealing with this in the context of the browser
same-origin policy is likely to be problematic.

## Special column names

### seqid

Used as an internal ID, and may also be used as name if nothing better is provided

### concept_name

Used as a name, and also for cross-matching with `seed` if supplied

### seed

If this matches the `concept_name` of another entry, that is used as a referece

### structure_url (and others)

`structure_url` is, as expected, a URL, and provides the default structure for the item.

Ideally, it should be accompanied by `structure_chains`.  Each row of this should be an *array* of 
chain letters, one entry per sequence column.  In case one sequence column corresponds with multiple
chains, it's possible to use comma-separated lists of chain letters, e.g.: `["A,B","C,D"] means the first
sequence column corresponds to chains A and B in the structure, while the second corresponds to C and D.

`structure_mappings` allows pre-computed residue mappings to be provided.  Format to follow.

## Key metadata properties

Note that this section is non-exhaustive -- in principle, anything which can be accomplished by via the GYDE
UI should also be possible by providing appropriate metadata on a send-to-GYDE request, but we prefer to check
and review specific options before formalizing their usage in send-to-GYDE.  If you've got a specific request,
please let us know!

### name (required)

An (ideally short) string giving the name of the session tab in GYDE

### isAntibody (strongly recommended, default true)

A boolean indicating whether various antibody-specific options should be enabled for this dataset.
Defaults to `true` for historical reasons, but we strongly recommend specifying this, even if `true`
for your dataset.

### hcColumn, lcColumn (default to "HC_sequence" and "LC_sequence" where appropriate)

For antibody datasets, the columns which refer to heavy and light chain sequences.

### seqColumns (strongly recommended)

An array of column name(s) indicating which columns are to be treated as sequences

### seqColumnNames

An array of strings -- which should be the same length as `seqColumns` -- indicating column titles
in the GYDE MSA view

### seqRefColumns

Array of columns specifying reference sequences

### alignmentKey (seqs, alignedSeqs, anarciSeqs)

How sequences should be displayed.  If "seqs", then sequences are displayed raw, with no attempt
at alignment.  If "alignedSeqs" then a conventional MSA will be generated by GYDE (currently using MAFFT).
If "anarciSeqs" [antibody mode only] then a residue-numbering-based alignment (currently using Absolve)
will be generated.

Defaults to "anarciSeqs" for antibody datasets, "alignedSeqs" otherwise.

### msaColumns 

Description of current "convential MSA" (see section below on pre-computed alignments).  Should be
an array of column descriptors specifying the name of the alignment column, and an array of strings
giving the "residue numbering" to use for the MSA.

### anarciColumns

Description of current "antibody-aware MSA"

### dataFields, msaDataFields [optional]

Lists of columns visible in the data table and MSA table (NB for the MSA table you *don't* need to list the sequence columns here)

### sortField [optional]

Name of field to sort on

## Sending pre-computed alignments

Like plain sequences, alignments are stored as normal data columns within the main dataset.  You can
name these columns whatever you like.  Within the columns, the data is stored as "augmented sequences"
(i.e. sequences with "-" characters inserted to represent alignment gaps).  You can generate the alignment
however you like.

You will probably want to use a "seed" column to indicate the reference sequence and enable
difference-highlighting in GYDE.

If you wish to send a dataset with a pre-computed alignment (e.g. from an external tool), set
`alignmentKey` to `alignedSeqs` and add a descriptor indicating which column(s) contain the
aligned data, e.g.:

```
{
    name: 'Constructs for P02747',
    alignmentKey: 'alignedSeqs',
    isAntibody: false,
    data,
    dataColumns: ['seqid', 'concept_name', 'seed', 'sequence', 'gyst_alignment', 'perc_identity'],
    seqColumns: ['sequence'],
    seqColumnNames: ['Sequence'],
    msaColumns: [
        // Should be one entry for each entry in seqColumns
        {
            column: 'gyst_alignment',  // Name of column in dataset containing augmented sequences
            numbering: REF_SEQ.split('').map((_, i) => `${i+1}`)    // If in doubt, use 1,2,3,...
        }
    ]
}
```

A working example can be found in the `send-to-gyde/alignment-demo` directory.

