package whatsapp

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"net/http"
	"strings"

	// Decoders registrados para image.Decode (auto-detección por formato).
	_ "image/gif"  // GIF (stdlib)
	_ "image/jpeg" // JPEG (stdlib)
	_ "image/png"  // PNG (stdlib)

	_ "golang.org/x/image/bmp"  // BMP
	_ "golang.org/x/image/webp" // WebP (decode-only)
)

// NormalizeImageForSend asegura que una imagen saliente tenga un formato que la
// WhatsApp Cloud API acepta como `image`: SOLO image/jpeg e image/png. WhatsApp
// rechaza WebP, HEIC, GIF, BMP, TIFF como imagen con el error #546. Las fotos
// del catálogo (Cloudinary) se sirven como WebP, así que se transcodifican a
// JPEG. No toca video/audio/documentos (pasan tal cual).
//
// Devuelve (data, mime, filename) posiblemente modificados. Si la imagen no se
// puede decodificar (ej. HEIC de iPhone, que Go puro no soporta), devuelve un
// error claro para el operador en vez del críptico #546.
func NormalizeImageForSend(data []byte, mime, filename string) ([]byte, string, string, error) {
	// Si el header viene vacío o genérico, detectar el tipo real por magic bytes.
	real := strings.ToLower(strings.TrimSpace(mime))
	if real == "" || real == "application/octet-stream" {
		real = http.DetectContentType(data)
	}

	// Solo nos importan las imágenes; el resto pasa sin cambios.
	if !strings.HasPrefix(real, "image/") {
		return data, mime, filename, nil
	}
	// jpeg y png los acepta WhatsApp directamente.
	if real == "image/jpeg" || real == "image/png" {
		return data, real, filename, nil
	}

	// Resto (webp, gif, bmp, tiff…): decodificar y re-encodear a JPEG.
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", "", fmt.Errorf(
			"no se pudo convertir la imagen (%s) a un formato compatible con WhatsApp; "+
				"convierte la foto a JPG o PNG antes de enviarla", real)
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 85}); err != nil {
		return nil, "", "", fmt.Errorf("error transcodificando la imagen a JPEG: %w", err)
	}
	return out.Bytes(), "image/jpeg", swapExtToJPG(filename), nil
}

// swapExtToJPG cambia la extensión del filename a .jpg (para coherencia con el
// nuevo mime tras transcodificar).
func swapExtToJPG(filename string) string {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return "imagen.jpg"
	}
	if i := strings.LastIndex(filename, "."); i >= 0 {
		return filename[:i] + ".jpg"
	}
	return filename + ".jpg"
}
