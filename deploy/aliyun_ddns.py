import argparse
import json
import os

from direct_gateway import GatewayError, discover_gateway


def choose_record(records, rr):
    matching = [record for record in records if record.rr == rr and record.type == "A"]
    if len(matching) > 1:
        raise GatewayError("Multiple A records exist for the H3 hostname; refusing to change them")
    return matching[0] if matching else None


def update_dns(domain, rr, address):
    from alibabacloud_alidns20150109.client import Client
    from alibabacloud_alidns20150109 import models
    from alibabacloud_tea_openapi.models import Config

    key = os.environ.get("Ali_Key")
    secret = os.environ.get("Ali_Secret")
    if not key or not secret:
        raise GatewayError("Aliyun DNS credentials have not been configured in the local protected file")
    client = Client(Config(access_key_id=key, access_key_secret=secret, endpoint="alidns.aliyuncs.com"))
    response = client.describe_domain_records(models.DescribeDomainRecordsRequest(
        domain_name=domain, rrkey_word=rr, type="A", search_mode="EXACT", page_size=500,
    ))
    if response.body.total_count > 500:
        raise GatewayError("Too many matching records; refusing a partial DNS update")
    current = choose_record(response.body.domain_records.record, rr)
    if current and current.value == address:
        return "unchanged"
    if current:
        client.update_domain_record(models.UpdateDomainRecordRequest(
            record_id=current.record_id, rr=rr, type="A", value=address, ttl=600,
        ))
        return "updated"
    client.add_domain_record(models.AddDomainRecordRequest(
        domain_name=domain, rr=rr, type="A", value=address, ttl=600,
    ))
    return "created"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    domain = os.environ.get("H3_DNS_DOMAIN", "yakiyyy.online")
    rr = os.environ.get("H3_DNS_RR", "h3")
    if domain != "yakiyyy.online" or rr != "h3":
        raise GatewayError("This deployment only manages h3.yakiyyy.online")
    gateway, address = discover_gateway()
    wan = gateway.call("GetExternalIPAddress")["NewExternalIPAddress"]
    import ipaddress
    if not ipaddress.ip_address(wan).is_global:
        raise GatewayError("Router WAN IPv4 is not public")
    result = update_dns(domain, rr, wan) if args.apply else "preview"
    print(json.dumps({"hostname": rr + "." + domain, "ipv4": wan, "result": result}))


if __name__ == "__main__":
    try:
        main()
    except GatewayError as error:
        raise SystemExit(str(error)) from None
    except Exception as error:
        raise SystemExit("DNS update failed: " + type(error).__name__ + "; credentials have not been printed") from None
