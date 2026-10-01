import { bookMetadataService } from "../src/server/services/metadata";
const isbn = process.argv[2] ?? "9784101010014";
bookMetadataService.lookupIsbn(isbn).then((r) => console.log(JSON.stringify(r, null, 1).slice(0, 1500)));
