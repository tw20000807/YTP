#include <bits/stdc++.h>
using namespace std;

int main(){
    cin.tie(0);
    ios_base::sync_with_stdio(0);
    //start here

    int N = 10;
    vector<vector<int>> edges(N);
    auto add_edges = [&](int a,int b){
        edges[a].push_back(b);
    };
    add_edges(1,5);
    add_edges(2,5);
    add_edges(3,5);
    add_edges(4,5);
    add_edges(5,6);
    add_edges(5,7);
    add_edges(5,8);
    add_edges(5,9);

}