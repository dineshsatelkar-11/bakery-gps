/**
 * IBCAB — Google Drive photo upload (drop-point + payment proof)
 *
 * Deploy as Web App on the NEW Gmail account:
 *   Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Client posts JSON:
 *   { shop_id: "S001", image: "<base64 without data: prefix>", kind: "payment_proof" optional }
 *
 * Response JSON:
 *   { ok: true, url: "https://drive.google.com/uc?export=view&id=FILE_ID", file_id: "FILE_ID" }
 *
 * Optional: set FOLDER_ID to an existing Drive folder ID (shared/owned by this account).
 * If empty, a folder "IBCAB Photos" is created in My Drive.
 */
var FOLDER_ID = ''; // e.g. '1abc...xyz' or leave blank

function doGet(e) {
  return json_({ ok: true, service: 'IBCAB Drive Upload', version: 2 });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    if (!raw) return json_({ ok: false, error: 'Empty body' });

    var body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      return json_({ ok: false, error: 'Invalid JSON' });
    }

    var shopId = String(body.shop_id || body.shopId || 'unknown').replace(/[^\w\-@.]/g, '_').slice(0, 80);
    var kind = String(body.kind || 'drop_photo').replace(/[^\w\-]/g, '_').slice(0, 40);
    var b64 = body.image || body.base64 || '';
    if (!b64) return json_({ ok: false, error: 'Missing image base64' });

    // Strip data-URL prefix if client sent full data URL
    var comma = b64.indexOf(',');
    if (b64.indexOf('data:') === 0 && comma >= 0) b64 = b64.substring(comma + 1);

    var bytes;
    try {
      bytes = Utilities.base64Decode(b64);
    } catch (err2) {
      return json_({ ok: false, error: 'Invalid base64' });
    }

    var mime = 'image/jpeg';
    if (body.mime) mime = String(body.mime);
    else if (kind === 'payment_proof') mime = 'image/jpeg';

    var folder = getUploadFolder_(kind);
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
    var name = kind + '_' + shopId + '_' + stamp + '.jpg';

    var blob = Utilities.newBlob(bytes, mime, name);
    var file = folder.createFile(blob);

    // Anyone with the link can VIEW — needed for admin app + Zoho attach download
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Workspace may block "anyone"; try domain or leave private and use export URL with id
      try {
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
      } catch (e3) {}
    }

    var fileId = file.getId();
    // Stable view URL (works well in <img src> when sharing is public-with-link)
    var url = 'https://drive.google.com/uc?export=view&id=' + fileId;

    return json_({
      ok: true,
      url: url,
      file_id: fileId,
      name: name,
      kind: kind,
      shop_id: shopId
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function getUploadFolder_(kind) {
  var root;
  if (FOLDER_ID) {
    try {
      root = DriveApp.getFolderById(FOLDER_ID);
    } catch (e) {
      root = null;
    }
  }
  if (!root) {
    var name = 'IBCAB Photos';
    var it = DriveApp.getFoldersByName(name);
    root = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  }
  // Subfolders: Drop Photos / Payment Proofs
  var sub = (kind === 'payment_proof') ? 'Payment Proofs' : 'Drop Photos';
  var sit = root.getFoldersByName(sub);
  if (sit.hasNext()) return sit.next();
  return root.createFolder(sub);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Manual test in Apps Script editor: Run → testUpload */
function testUpload() {
  // 1x1 pixel jpeg base64
  var tiny = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwA/AL+AAf/Z';
  var e = { postData: { contents: JSON.stringify({ shop_id: 'TEST', image: tiny, kind: 'test' }) } };
  var out = doPost(e);
  Logger.log(out.getContent());
}
