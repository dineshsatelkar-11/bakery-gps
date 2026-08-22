/**
 * IBCAB — Google Drive photo upload (drop-point + payment proof)
 *
 * Deploy as Web App on the Drive Gmail account:
 *   Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Client posts JSON:
 *   { shop_id: "S001", image: "<base64>", kind: "payment_proof" | "drop_photo" }
 *
 * Response JSON:
 *   {
 *     ok: true,
 *     url: "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
 *     view_url: same (open in browser),
 *     img_url: "https://drive.google.com/thumbnail?id=FILE_ID&sz=w1200",
 *     file_id: "FILE_ID"
 *   }
 *
 * Optional: set FOLDER_ID to an existing Drive folder ID.
 */
var FOLDER_ID = ''; // e.g. '1abc...xyz' or leave blank

function doGet(e) {
  return json_({ ok: true, service: 'IBCAB Drive Upload', version: 3 });
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

    var comma = b64.indexOf(',');
    if (b64.indexOf('data:') === 0 && comma >= 0) b64 = b64.substring(comma + 1);

    var bytes;
    try {
      bytes = Utilities.base64Decode(b64);
    } catch (err2) {
      return json_({ ok: false, error: 'Invalid base64' });
    }

    var mime = body.mime ? String(body.mime) : 'image/jpeg';

    var folder = getUploadFolder_(kind);
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyyMMdd-HHmmss');
    var name = kind + '_' + shopId + '_' + stamp + '.jpg';

    var blob = Utilities.newBlob(bytes, mime, name);
    var file = folder.createFile(blob);

    // Anyone with the link can VIEW — required for admin/customer/Zoho
    var shareOk = false;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      shareOk = true;
    } catch (shareErr) {
      try {
        file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
        shareOk = true;
      } catch (e3) {
        shareOk = false;
      }
    }

    var fileId = file.getId();

    // Prefer stable "file view" link — uc?export=view often shows "unable to open the file"
    var viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';
    // Thumbnail works better for <img src> when link-sharing is on
    var imgUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
    // Fallback direct
    var ucUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;

    return json_({
      ok: true,
      url: viewUrl,
      view_url: viewUrl,
      img_url: imgUrl,
      uc_url: ucUrl,
      file_id: fileId,
      name: name,
      kind: kind,
      shop_id: shopId,
      share_ok: shareOk
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

/** Manual test: Run → testUpload */
function testUpload() {
  var tiny = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwA/AL+AAf/Z';
  var e = { postData: { contents: JSON.stringify({ shop_id: 'TEST', image: tiny, kind: 'payment_proof' }) } };
  var out = doPost(e);
  Logger.log(out.getContent());
}
