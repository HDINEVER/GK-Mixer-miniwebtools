package com.hdinever.gkmixer;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("base64Data is required");
            return;
        }

        // Clean prefix if it contains "data:image/...;base64,"
        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }

        byte[] imageBytes;
        try {
            imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid base64 data: " + e.getMessage());
            return;
        }

        String filename = call.getString("filename");
        if (filename == null || filename.trim().isEmpty()) {
            filename = "gk-mixer-swatch-" + System.currentTimeMillis() + ".png";
        }
        if (!filename.toLowerCase().endsWith(".png") && !filename.toLowerCase().endsWith(".jpg")) {
            filename += ".png";
        }

        Context context = getContext();
        try {
            Uri imageUri = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/GKMixer");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                ContentResolver resolver = context.getContentResolver();
                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

                if (imageUri != null) {
                    try (OutputStream out = resolver.openOutputStream(imageUri)) {
                        if (out != null) {
                            out.write(imageBytes);
                            out.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(imageUri, values, null, null);
                }
            } else {
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File targetDir = new File(picturesDir, "GKMixer");
                if (!targetDir.exists()) {
                    targetDir.mkdirs();
                }
                File imageFile = new File(targetDir, filename);
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }
                imageUri = Uri.fromFile(imageFile);
                Intent mediaScanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                mediaScanIntent.setData(imageUri);
                context.sendBroadcast(mediaScanIntent);
            }

            if (imageUri == null) {
                call.reject("Failed to create MediaStore record");
                return;
            }

            new Handler(Looper.getMainLooper()).post(() -> {
                Toast.makeText(context, "已成功保存色卡到手机相册 (Pictures/GKMixer)", Toast.LENGTH_LONG).show();
            });

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("uri", imageUri.toString());
            ret.put("filePath", "Pictures/GKMixer/" + filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save image to gallery: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64Data = call.getString("base64Data");
        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("base64Data is required");
            return;
        }

        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }

        byte[] imageBytes;
        try {
            imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid base64 data: " + e.getMessage());
            return;
        }

        String filename = call.getString("filename");
        if (filename == null || filename.trim().isEmpty()) {
            filename = "gk-mixer-swatch-" + System.currentTimeMillis() + ".png";
        }
        if (!filename.toLowerCase().endsWith(".png") && !filename.toLowerCase().endsWith(".jpg")) {
            filename += ".png";
        }

        Context context = getContext();
        try {
            File cacheDir = new File(context.getCacheDir(), "shared_images");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File cacheFile = new File(cacheDir, filename);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(imageBytes);
                fos.flush();
            }

            String authority = context.getPackageName() + ".fileprovider";
            Uri contentUri = FileProvider.getUriForFile(context, authority, cacheFile);

            String title = call.getString("title");
            if (title == null || title.trim().isEmpty()) {
                title = "分享色卡标注";
            }

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/png");
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to share image: " + e.getMessage(), e);
        }
    }
}
