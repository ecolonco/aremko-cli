package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// downloadForSend baja un archivo público (foto/video del catálogo de la web) para
// reenviarlo por un canal de la bandeja (H-025 — biblioteca de medios). Devuelve
// bytes + MIME + filename. Corta en maxMediaBytes. Permite reusar el flujo de envío
// de media (WhatsApp/IG/Messenger) cuando el origen es una URL en vez de un archivo
// subido por el usuario.
func downloadForSend(rawURL string) ([]byte, string, string, error) {
	if strings.TrimSpace(rawURL) == "" {
		return nil, "", "", fmt.Errorf("media_url vacío")
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return nil, "", "", fmt.Errorf("error descargando media_url: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", "", fmt.Errorf("media_url status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxMediaBytes+1))
	if err != nil {
		return nil, "", "", err
	}
	if int64(len(data)) > maxMediaBytes {
		return nil, "", "", fmt.Errorf("media_url excede %d bytes", maxMediaBytes)
	}
	mime := resp.Header.Get("Content-Type")
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	if mime == "" {
		mime = "application/octet-stream"
	}
	filename := "archivo"
	if u, e := url.Parse(rawURL); e == nil {
		if base := path.Base(u.Path); base != "" && base != "/" && base != "." {
			filename = base
		}
	}
	return data, mime, filename, nil
}

// mediaFromRequest obtiene los bytes a enviar de un request multipart: o el archivo
// 'file' subido, o (si no hay) el 'media_url' de la biblioteca, que se descarga.
// Centraliza la lógica común de los tres handlers de envío de media.
func mediaFromRequest(r *http.Request) (data []byte, mime, filename string, err error) {
	if file, hdr, ferr := r.FormFile("file"); ferr == nil {
		defer file.Close()
		data, err = io.ReadAll(file)
		if err != nil {
			return nil, "", "", fmt.Errorf("no se pudo leer el archivo")
		}
		mime = hdr.Header.Get("Content-Type")
		filename = hdr.Filename
	} else if mu := strings.TrimSpace(r.FormValue("media_url")); mu != "" {
		data, mime, filename, err = downloadForSend(mu)
		if err != nil {
			return nil, "", "", err
		}
	} else {
		return nil, "", "", fmt.Errorf("falta el archivo 'file' o 'media_url'")
	}
	if int64(len(data)) > maxMediaBytes {
		return nil, "", "", fmt.Errorf("archivo demasiado grande (máx 16 MB)")
	}
	if mime == "" {
		mime = "application/octet-stream"
	}
	if filename == "" {
		filename = "archivo"
	}
	return data, mime, filename, nil
}
