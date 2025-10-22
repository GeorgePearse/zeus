// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package opencode_test

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/sst/zeus-sdk-go"
	"github.com/sst/zeus-sdk-go/internal/testutil"
	"github.com/sst/zeus-sdk-go/option"
)

func TestFileListWithOptionalParams(t *testing.T) {
	t.Skip("Prism tests are disabled")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := zeus.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.File.List(context.TODO(), zeus.FileListParams{
		Path:      zeus.F("path"),
		Directory: zeus.F("directory"),
	})
	if err != nil {
		var apierr *zeus.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestFileReadWithOptionalParams(t *testing.T) {
	t.Skip("Prism tests are disabled")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := zeus.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.File.Read(context.TODO(), zeus.FileReadParams{
		Path:      zeus.F("path"),
		Directory: zeus.F("directory"),
	})
	if err != nil {
		var apierr *zeus.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}

func TestFileStatusWithOptionalParams(t *testing.T) {
	t.Skip("Prism tests are disabled")
	baseURL := "http://localhost:4010"
	if envURL, ok := os.LookupEnv("TEST_API_BASE_URL"); ok {
		baseURL = envURL
	}
	if !testutil.CheckTestServer(t, baseURL) {
		return
	}
	client := zeus.NewClient(
		option.WithBaseURL(baseURL),
	)
	_, err := client.File.Status(context.TODO(), zeus.FileStatusParams{
		Directory: zeus.F("directory"),
	})
	if err != nil {
		var apierr *zeus.Error
		if errors.As(err, &apierr) {
			t.Log(string(apierr.DumpRequest(true)))
		}
		t.Fatalf("err should be nil: %s", err.Error())
	}
}
